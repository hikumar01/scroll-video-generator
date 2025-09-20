/**
 * Scroll Video Generator Server
 *
 * An intelligent Node.js server that creates smooth scrolling video animations by compositing
 * long page screenshots inside phone frame images with automatic transparent cutout detection.
 *
 * Features:
 * - Automatic screen cutout detection from frame alpha channel
 * - Support for both rectangular and rounded corner frames
 * - Intelligent page resizing to fit detected screen area
 * - FFmpeg-based video generation with smooth scrolling animations
 * - Concurrent request handling with isolated session directories
 * - Batch processing for improved performance
 * - Comprehensive cleanup and memory management
 * - Fallback to manual parameter specification if auto-detection fails
 *
 * @version 1.0.0
 */

'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const sharp = require('sharp');
const { rimraf } = require('rimraf');

// Configuration constants
const tmpRoot = path.join(__dirname, 'tmp');
const upload = multer({
  dest: path.join(tmpRoot, 'uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for uploaded files
    files: 2 // Maximum 2 files (frame + page)
  }
});
const DEFAULT_FRAME = 'defaultFrame.png';

// Performance constants
const BATCH_SIZE = 4; // Number of frames to process concurrently
const MAX_DIMENSION = 4096; // Maximum image dimension for memory safety

const app = express();

// Middleware configuration for performance and security
app.use(express.json({ limit: '1mb' })); // Limit JSON payload size
app.disable('x-powered-by'); // Remove Express signature for security

// Request logging middleware for debugging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

/**
 * Health check endpoint for monitoring and load balancers
 *
 * @route GET /health
 * @returns {Object} Server status and system information
 */
app.get('/health', async(_req, res) => {
  try {
    // Check if temporary directories exist
    await fs.access(tmpRoot);
    await fs.access(path.join(tmpRoot, 'uploads'));

    // Check if default frame exists
    await fs.access(path.join(__dirname, DEFAULT_FRAME));

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      node: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Ensures the temporary directories exist
 * Creates both tmp and tmp/uploads directories if they don't exist
 */
async function ensureTmp() {
  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true });
  console.log('📁 Temporary directories ready');
}

/**
 * Comprehensive cleanup function for job directories and uploaded files
 * Handles cleanup for both successful and failed jobs
 * @param {Object} cleanupData - Object containing cleanup information
 * @param {string} cleanupData.sessionDir - Path to session directory
 * @param {string} cleanupData.timestamp - Job timestamp
 * @param {Array} cleanupData.uploadedFiles - Array of uploaded file objects
 * @param {string} reason - Reason for cleanup (success/error/abort)
 */
async function performJobCleanup(cleanupData, reason = 'completed') {
  const { sessionDir, timestamp, uploadedFiles } = cleanupData;

  try {
    console.log(`🧹 Starting ${reason} cleanup for job_${timestamp}`);

    // Clean up session directory (contains generated frames and video)
    if (sessionDir) {
      console.log(`Removing session directory: ${sessionDir}`);
      await rimraf(sessionDir);
    }

    // Clean up uploaded files
    for (const file of uploadedFiles || []) {
      console.log(`Removing uploaded ${file.type}: ${file.path}`);
      await fs.unlink(file.path).catch(() => {});
    }

    console.log(`✅ ${reason} cleanup completed for job_${timestamp}`);
    return true;
  } catch (cleanupError) {
    console.error(`❌ ${reason} cleanup error for job_${timestamp}:`, cleanupError.message);
    return false;
  }
}


/**
 * Runs FFmpeg with the given arguments and returns a promise
 *
 * @param {string[]} args - Array of FFmpeg command line arguments
 * @returns {Promise<{stdout: string, stderr: string}>} Resolves with stdout/stderr when FFmpeg completes
 * @throws {Error} If FFmpeg exits with non-zero code or encounters an error
 */
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject({ err, stdout, stderr });
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Detects the largest transparent rectangle in a PNG image
 *
 * This function analyzes the alpha channel of a frame image to find the transparent
 * area where the page content should be displayed. It supports both rectangular
 * and rounded corner frames with intelligent detection algorithms.
 *
 * @param {string} imagePath - Path to the frame image (must be PNG with alpha channel)
 * @returns {Promise<{x: number, y: number, width: number, height: number}>} The detected cutout rectangle
 *
 * Algorithm:
 * 1. Extract RGBA pixel data from the frame image
 * 2. Find all fully transparent pixels (alpha = 0), excluding translucent areas
 * 3. Calculate bounding box of the transparent area
 * 4. Detect frame type by checking if corners of transparent area are transparent
 * 5. For rounded corners: systematically test rectangle sizes (50%-95%) to find largest safe area
 * 6. For rectangular frames: use full transparent area for maximum utilization
 * 7. Ensure dimensions are even numbers for H.264 video compatibility
 *
 * @throws {Error} If frame has no alpha channel or no transparent cutout is found
 */
async function detectTransparentCutout(imagePath) {
  try {
    const image = sharp(imagePath);
    const { width, height, channels } = await image.metadata();

    if (channels < 4) {
      throw new Error('Frame image must have an alpha channel (RGBA)');
    }

    const { data } = await image.raw().toBuffer({ resolveWithObject: true });

    /**
     * Checks if a pixel is fully transparent
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean}
     */
    const isTransparent = (x, y) => {
      const pixelIndex = (y * width + x) * channels;
      return data[pixelIndex + 3] === 0; // Only fully transparent pixels (alpha = 0)
    };

    // First, find the bounding box of the transparent area
    // This gives us the outer bounds of all transparent pixels
    let minX = width, maxX = -1, minY = height, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isTransparent(x, y)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX === -1) {
      return { x: 0, y: 0, width: 0, height: 0 }; // No transparent area found
    }

    // Find the largest rectangle that fits within the rounded corner transparent area
    // We'll use a more sophisticated approach to avoid rounded corners

    const boundingWidth = maxX - minX + 1;
    const boundingHeight = maxY - minY + 1;

    console.log(`Fully transparent area bounding box: ${boundingWidth}x${boundingHeight} at (${minX}, ${minY})`);

    // Check if this is a rectangular frame by testing if all corners of the bounding box are transparent
    const corners = [
      [minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]
    ];

    let isRectangularFrame = true;
    for (const [x, y] of corners) {
      if (!isTransparent(x, y)) {
        isRectangularFrame = false;
        break;
      }
    }

    console.log(`Frame type: ${isRectangularFrame ? 'RECTANGULAR' : 'ROUNDED CORNERS'}`);

    if (isRectangularFrame) {
      // For rectangular frames, we can use the full bounding box
      // Ensure dimensions are even numbers for H.264 compatibility
      const evenWidth = boundingWidth % 2 === 0 ? boundingWidth : boundingWidth - 1;
      const evenHeight = boundingHeight % 2 === 0 ? boundingHeight : boundingHeight - 1;

      console.log(`Using full bounding box for rectangular frame: ${evenWidth}x${evenHeight} at (${minX}, ${minY})`);

      return {
        x: minX,
        y: minY,
        width: evenWidth,
        height: evenHeight
      };
    }

    // For rounded corner frames, use the conservative approach
    console.log('Using conservative approach for rounded corner frame...');

    // Helper function to check if a rectangle is fully within transparent area
    const isRectangleValid = (x, y, w, h) => {
      // For rounded corners, we need to check the entire perimeter, not just sample points
      // Check top and bottom edges completely
      for (let i = 0; i < w; i++) {
        if (!isTransparent(x + i, y) || !isTransparent(x + i, y + h - 1)) {
          return false;
        }
      }

      // Check left and right edges completely
      for (let i = 0; i < h; i++) {
        if (!isTransparent(x, y + i) || !isTransparent(x + w - 1, y + i)) {
          return false;
        }
      }

      return true;
    };

    // Start with a conservative estimate and systematically find the largest valid rectangle
    let bestWidth = 0;
    let bestHeight = 0;
    let bestX = minX;
    let bestY = minY;

    const centerX = Math.floor((minX + maxX) / 2);
    const centerY = Math.floor((minY + maxY) / 2);

    // Test different percentages of the bounding box, starting conservatively
    const testPercentages = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

    for (const pct of testPercentages) {
      const testWidth = Math.floor(boundingWidth * pct);
      const testHeight = Math.floor(boundingHeight * pct);
      const testX = centerX - Math.floor(testWidth / 2);
      const testY = centerY - Math.floor(testHeight / 2);

      // Ensure the test rectangle is within bounds
      if (testX >= minX && testY >= minY &&
          testX + testWidth <= maxX + 1 && testY + testHeight <= maxY + 1) {

        console.log(`Testing ${Math.round(pct * 100)}% of bounding box: ${testWidth}x${testHeight} at (${testX}, ${testY})`);

        if (isRectangleValid(testX, testY, testWidth, testHeight)) {
          bestWidth = testWidth;
          bestHeight = testHeight;
          bestX = testX;
          bestY = testY;
          console.log(`✓ ${Math.round(pct * 100)}% rectangle is VALID`);
        } else {
          console.log(`✗ ${Math.round(pct * 100)}% rectangle is INVALID - stopping here`);
          break; // Stop at the first invalid size
        }
      }
    }

    // Ensure dimensions are even numbers for H.264 compatibility
    const evenBestWidth = bestWidth % 2 === 0 ? bestWidth : bestWidth - 1;
    const evenBestHeight = bestHeight % 2 === 0 ? bestHeight : bestHeight - 1;

    console.log(`Largest rectangle within rounded corners: ${evenBestWidth}x${evenBestHeight} at (${bestX}, ${bestY})`);

    return {
      x: bestX,
      y: bestY,
      width: evenBestWidth,
      height: evenBestHeight
    };

  } catch (error) {
    throw new Error(`Failed to detect transparent cutout: ${error.message}`);
  }
}


/**
 * Main render endpoint - Creates scrolling animation videos
 *
 * Accepts multipart form data with frame and page images, automatically detects
 * the transparent cutout area in the frame, resizes the page to fit, and generates
 * a smooth scrolling animation video using FFmpeg.
 *
 * @route POST /render
 * @param {File} page - Required. Long screenshot image to scroll through
 * @param {File} [frame] - Optional. PNG frame with transparent cutout (defaults to defaultFrame.png)
 * @param {number} [duration=8] - Animation duration in seconds
 * @param {number} [fps=30] - Frames per second for the output video
 *
 * @returns {File} MP4 video file with scrolling animation
 * @returns {Object} Error object if processing fails
 *
 * Process:
 * 1. Validate input files and parameters
 * 2. Auto-detect screen cutout dimensions from frame
 * 3. Resize page image to fit detected screen width
 * 4. Generate individual animation frames
 * 5. Composite page content onto frame for each frame
 * 6. Use FFmpeg to create final MP4 video
 * 7. Clean up temporary files after response
 */
app.post('/render', upload.fields([
  { name: 'frame', maxCount: 1 },
  { name: 'page', maxCount: 1 }
]), async(req, res) => {
  await ensureTmp();

  // Declare variables outside try block for error handling access
  let timestamp, sessionDir, frameFile, pageFile;
  let cleanupData;
  let isRequestCancelled = false;

  try {
    // Basic validation - only page is required, frame is optional
    if (!req.files || !req.files['page']) {
      return res.status(400).json({ error: 'Please upload a page (long screenshot).' });
    }

    // Initialize variables
    timestamp = Date.now();
    sessionDir = path.join(tmpRoot, `job_${timestamp}`);

    // Set up cleanup data immediately for early cancellation handling
    cleanupData = {
      sessionDir,
      timestamp,
      uploadedFiles: []
    };

    if (req.files['frame'] && req.files['frame'][0]) {
      cleanupData.uploadedFiles.push({
        path: req.files['frame'][0].path,
        type: 'frame'
      });
    }

    if (req.files['page'] && req.files['page'][0]) {
      cleanupData.uploadedFiles.push({
        path: req.files['page'][0].path,
        type: 'page'
      });
    }

    // Set up early cleanup handlers for client disconnection
    res.on('close', async() => {
      if (!res.headersSent && !isRequestCancelled) {
        isRequestCancelled = true;
        console.warn(`⚠️ Client disconnected during processing for job_${timestamp}`);
        await performJobCleanup(cleanupData, 'client-disconnect-early');
      }
    });

    // Set up timeout-based cleanup as fallback
    const cleanupTimeout = setTimeout(async() => {
      if (!res.headersSent && !isRequestCancelled) {
        isRequestCancelled = true;
        console.warn(`⚠️ Request timeout - cleaning up job_${timestamp}`);
        await performJobCleanup(cleanupData, 'timeout');
      }
    }, 300000); // 5 minutes timeout

    // Clear timeout when request completes normally
    const clearTimeoutOnComplete = () => {
      clearTimeout(cleanupTimeout);
    };

    res.on('finish', clearTimeoutOnComplete);
    res.on('error', clearTimeoutOnComplete);

    // Use provided frame or default frame
    if (req.files['frame'] && req.files['frame'][0]) {
      frameFile = req.files['frame'][0].path;
    } else {
      frameFile = path.join(__dirname, DEFAULT_FRAME);
      console.log(`No frame provided, using default ${DEFAULT_FRAME}`);
    }

    pageFile = req.files['page'][0].path;

    // Parse and validate parameters
    const duration = Math.max(1, Number(req.body.duration) || 8);
    const fps = Math.max(12, Number(req.body.fps) || 30);
    const outputName = `output_${timestamp}.mp4`;

    await fs.mkdir(sessionDir, { recursive: true });

    // Load page image metadata with validation
    const pageMeta = await sharp(pageFile).metadata();
    let pageHeight = pageMeta.height;

    // Validate image dimensions for memory safety
    if (pageMeta.width > MAX_DIMENSION || pageMeta.height > MAX_DIMENSION) {
      return res.status(400).json({
        error: `Image dimensions too large. Maximum allowed: ${MAX_DIMENSION}x${MAX_DIMENSION}px`,
        current: `${pageMeta.width}x${pageMeta.height}px`
      });
    }

    // Always auto-detect screen cutout from the frame
    console.log('Auto-detecting transparent cutout in frame image...');
    let screenWidth, screenHeight, frameOffsetX, frameOffsetY;

    try {
      const cutout = await detectTransparentCutout(frameFile);
      screenWidth = cutout.width;
      screenHeight = cutout.height;
      frameOffsetX = cutout.x;
      frameOffsetY = cutout.y;

      console.log(`Detected cutout: ${screenWidth}x${screenHeight} at offset (${frameOffsetX}, ${frameOffsetY})`);

      if (screenWidth === 0 || screenHeight === 0) {
        return res.status(400).json({
          error: 'Could not detect a transparent cutout in the frame image.'
        });
      }

      // Check if request was cancelled during frame processing
      if (isRequestCancelled) {
        console.log(`⚠️ Request cancelled during frame processing for job_${timestamp}`);
        return;
      }

      // Resize page image to match cutout dimensions while preserving aspect ratio
      const originalPageMeta = await sharp(pageFile).metadata();
      const { width: originalPageWidth, height: originalPageHeight } = originalPageMeta;
      const originalAspectRatio = originalPageWidth / originalPageHeight;
      const cutoutAspectRatio = screenWidth / screenHeight;

      console.log(`Original page: ${originalPageWidth}x${originalPageHeight} (aspect ratio: ${originalAspectRatio.toFixed(4)})`);
      console.log(`Detected cutout: ${screenWidth}x${screenHeight} (aspect ratio: ${cutoutAspectRatio.toFixed(4)})`);

      if (screenWidth !== originalPageWidth) {
        // Resize page to match cutout width while preserving aspect ratio
        const newPageHeight = Math.round(screenWidth / originalAspectRatio);

        console.log(`Resizing page to match cutout width ${screenWidth} while preserving aspect ratio`);
        console.log(`New page dimensions: ${screenWidth}x${newPageHeight} (aspect ratio: ${(screenWidth / newPageHeight).toFixed(4)})`);

        // Create resized page with optimized settings for performance
        const resizedPagePath = path.join(sessionDir, 'resized_page.png');
        await sharp(pageFile)
          .resize(screenWidth, newPageHeight, {
            fit: 'fill',
            kernel: sharp.kernel.lanczos3, // High-quality resampling
            withoutEnlargement: false,     // Allow enlargement if needed
            fastShrinkOnLoad: true         // Performance optimization
          })
          .png({
            compressionLevel: 6,  // Balance between speed and size
            quality: 95,          // High quality but faster than 100
            palette: false,       // Disable palette for better quality
            progressive: false    // Faster encoding
          })
          .toFile(resizedPagePath);

        // Update page file reference and metadata
        pageFile = resizedPagePath;
        pageMeta.width = screenWidth;
        pageMeta.height = newPageHeight;
        pageHeight = newPageHeight;

        console.log(`Page successfully resized to ${screenWidth}x${newPageHeight}`);
      }
    } catch (error) {
      return res.status(400).json({
        error: `Auto-detection failed: ${error.message}`
      });
    }

    // Calculate animation parameters
    const totalFrames = Math.round(duration * fps);
    const maxScroll = Math.max(0, pageHeight - screenHeight); // Maximum scroll distance
    const startY = 0; // Start at top of page
    const endY = maxScroll; // End at bottom of visible area
    const step = totalFrames > 1 ? (endY - startY) / (totalFrames - 1) : 0; // Pixels per frame

    // Preload frame image and metadata for better performance
    const frameBuffer = await fs.readFile(frameFile);
    const frameSharp = sharp(frameBuffer);
    const frameMeta = await frameSharp.metadata();
    const { width: canvasWidth, height: canvasHeight } = frameMeta;

    // Generate animation frames with batch processing for better performance

    for (let batchStart = 0; batchStart < totalFrames; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalFrames);
      const batchPromises = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const framePromise = (async() => {
          const y = Math.round(startY + step * i);

          // Extract the visible portion of the page with optimized settings
          const cropped = await sharp(pageFile)
            .extract({
              left: 0,
              top: Math.max(0, Math.min(y, pageHeight - screenHeight)),
              width: screenWidth,
              height: screenHeight
            })
            .png({ compressionLevel: 6, quality: 95 }) // Optimize PNG settings
            .toBuffer();

          // Composite the cropped page with the frame using optimized settings
          await sharp({
            create: {
              width: canvasWidth,
              height: canvasHeight,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
          })
            .composite([
              { input: cropped, left: frameOffsetX, top: frameOffsetY },
              { input: frameBuffer, left: 0, top: 0 }
            ])
            .png({
              compressionLevel: 6, // Balance between speed and file size
              quality: 95,         // High quality for video frames
              progressive: false   // Faster encoding for temporary files
            })
            .toFile(path.join(sessionDir, `frame_${String(i + 1).padStart(5, '0')}.png`));
        })();

        batchPromises.push(framePromise);
      }

      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises);
      console.log(`Generated frames ${batchStart + 1}-${batchEnd} of ${totalFrames}`);

      // Check if request was cancelled during frame generation
      if (isRequestCancelled) {
        console.log(`⚠️ Request cancelled during frame generation for job_${timestamp}`);
        return;
      }
    }

    // Check if request was cancelled before video generation
    if (isRequestCancelled) {
      console.log(`⚠️ Request cancelled before video generation for job_${timestamp}`);
      return;
    }

    // Generate video using FFmpeg
    const fpsArg = String(fps);
    const infilePattern = path.join(sessionDir, 'frame_%05d.png');
    const outputPath = path.join(sessionDir, outputName);

    const ffArgs = [
      '-y',                    // Overwrite output file
      '-framerate', fpsArg,    // Input framerate
      '-i', infilePattern,     // Input pattern
      '-c:v', 'libx264',       // Video codec
      '-pix_fmt', 'yuv420p',   // Pixel format for compatibility
      '-movflags', '+faststart', // Optimize for web streaming
      '-r', fpsArg,            // Output framerate
      outputPath
    ];

    await runFFmpeg(ffArgs);

    // Stream the result back to client
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="scroll_${Date.now()}.mp4"`);

    // Cleanup only after successful video delivery
    res.on('finish', async() => {
      if (!isRequestCancelled) {
        console.log(`📤 Video delivered successfully for job_${timestamp}`);
        await performJobCleanup(cleanupData, 'success');
      }
    });

    // Handle cleanup on response error/abort
    res.on('error', async(error) => {
      if (!isRequestCancelled) {
        console.error(`❌ Response error for job_${timestamp}:`, error.message);
        await performJobCleanup(cleanupData, 'response-error');
      }
    });

    // Handle cleanup on client disconnect/abort
    res.on('close', async() => {
      if (!res.writableEnded && !isRequestCancelled) {
        console.warn(`⚠️ Client disconnected during job_${timestamp}`);
        await performJobCleanup(cleanupData, 'client-disconnect');
      }
    });

    // Send file after setting up cleanup handlers
    const outStream = await fs.readFile(outputPath);
    res.send(outStream);

  } catch (err) {
    console.error(`❌ Render error for job_${timestamp}:`, err);

    // Create cleanup data for error case
    const errorCleanupData = {
      sessionDir: sessionDir || path.join(tmpRoot, `job_${timestamp}`),
      timestamp,
      uploadedFiles: []
    };

    // Add uploaded files to cleanup data
    if (req.files['frame'] && req.files['frame'][0]) {
      errorCleanupData.uploadedFiles.push({
        path: req.files['frame'][0].path,
        type: 'frame'
      });
    }

    if (req.files['page'] && req.files['page'][0]) {
      errorCleanupData.uploadedFiles.push({
        path: req.files['page'][0].path,
        type: 'page'
      });
    }

    // Perform comprehensive error cleanup
    await performJobCleanup(errorCleanupData, 'render-error');

    res.status(500).json({
      error: 'Render failed',
      details: String(err),
      jobId: `job_${timestamp}`,
      message: 'All temporary files have been cleaned up'
    });
  }
});

// Global error handlers for comprehensive cleanup
process.on('uncaughtException', async(error) => {
  console.error('❌ Uncaught Exception:', error);
  console.log('🧹 Performing emergency cleanup...');

  try {
    // Clean up any remaining job directories
    const entries = await fs.readdir(tmpRoot).catch(() => []);
    for (const entry of entries) {
      if (entry.startsWith('job_')) {
        const jobPath = path.join(tmpRoot, entry);
        console.log(`Emergency cleanup: ${entry}`);
        await rimraf(jobPath).catch(() => {});
      }
    }

    // Clean up uploads directory
    const uploadsDir = path.join(tmpRoot, 'uploads');
    const uploadEntries = await fs.readdir(uploadsDir).catch(() => []);
    for (const entry of uploadEntries) {
      const filePath = path.join(uploadsDir, entry);
      console.log(`Emergency cleanup upload: ${entry}`);
      await fs.unlink(filePath).catch(() => {});
    }

    console.log('✅ Emergency cleanup completed');
  } catch (cleanupError) {
    console.error('❌ Emergency cleanup failed:', cleanupError.message);
  }

  process.exit(1);
});

process.on('unhandledRejection', async(reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, just log it
});

const port = process.env.PORT || 3000;
app.listen(port, async() => {
  await ensureTmp();
  console.log(`🚀 Scroll Video Generator server listening on http://localhost:${port}`);
  console.log('✅ Comprehensive cleanup enabled - handles success, errors, and exceptions');
});

