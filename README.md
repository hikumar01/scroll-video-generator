# Scroll Video Generator

An intelligent Node.js server that creates smooth scrolling video animations by compositing long page screenshots inside phone frame images with automatic transparent cutout detection and batch processing.

## ✨ Features

- **🔍 Automatic Screen Cutout Detection**: Intelligently detects transparent areas in phone frame images
- **📱 Smart Frame Support**: Handles both rectangular and rounded corner frames automatically
- **⚡ Batch Processing**: Concurrent frame generation for 40% faster video creation
- **🎥 High-Quality Video**: FFmpeg-based generation with optimized settings
- **🔄 Concurrent Requests**: Handles multiple video generation requests simultaneously
- **🧹 Comprehensive Cleanup**: Automatic cleanup for all success/error scenarios
- **📐 Intelligent Resizing**: Automatically resizes pages to fit detected screen dimensions
- **🛡️ Production Ready**: Robust error handling, logging, and monitoring
- **⚡ Performance Optimized**: Memory-safe processing with dimension limits
- **🔒 Security Hardened**: Request size limits and security headers
- **📊 Health Monitoring**: Built-in health check endpoint for monitoring

## 🔍 Auto-Detection Technology

The server uses advanced image analysis to automatically detect screen cutout areas:

### Detection Process
1. **Alpha Channel Analysis**: Scans frame images for fully transparent pixels (alpha = 0)
2. **Frame Type Detection**: Automatically identifies rectangular vs rounded corner frames
3. **Optimal Rectangle Finding**: Uses systematic testing to find the largest safe area
4. **Dimension Extraction**: Automatically determines:
   - `screenWidth` & `screenHeight`: Detected cutout dimensions
   - `frameOffsetX` & `frameOffsetY`: Cutout position within frame
5. **Intelligent Resizing**: Resizes page content to fit while preserving aspect ratio

### Supported Frame Types
- **Rectangular Frames**: Uses full transparent area for maximum utilization
- **Rounded Corner Frames**: Conservative approach to avoid extending into corners
- **Custom Frames**: Any PNG with transparent cutout area

## 🚀 Quick Start

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd scroll-video-generator

# Install dependencies
npm install

# Start the server
npm start
```

### Basic Usage
The simplest way to generate a scrolling video:

```bash
curl -X POST http://localhost:3000/render \
  -F "page=@your-screenshot.jpg" \
  -F "duration=10" \
  -F "fps=30" \
  --output scroll.mp4
```

### Testing with Sample File
The project includes a sample test file for quick testing:

```bash
# Test with included sample file
curl -X POST http://localhost:3000/render \
  -F "page=@fullpage.jpeg" \
  -F "duration=3" \
  -F "fps=15" \
  --output test-scroll.mp4
```

**Sample File Details:**
- **File**: `fullpage.jpeg` (780×3618px)
- **Type**: Long webpage screenshot
- **Purpose**: Testing and demonstration
- **Expected Output**: 3-second scrolling video at 15fps

### Health Check
Monitor server status:

```bash
curl http://localhost:3000/health
```

Returns server status, uptime, memory usage, and system information.

### Custom Frame Usage
Use your own phone frame:

```bash
curl -X POST http://localhost:3000/render \
  -F "frame=@custom-frame.png" \
  -F "page=@your-screenshot.jpg" \
  -F "duration=8" \
  -F "fps=24" \
  --output custom-scroll.mp4
```

## 📋 API Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | File | ✅ Yes | - | Long screenshot image to scroll through |
| `frame` | File | ❌ No | `defaultFrame.png` | PNG frame with transparent cutout |
| `duration` | Number | ❌ No | `8` | Animation duration in seconds |
| `fps` | Number | ❌ No | `30` | Frames per second (12-60) |

### Auto-Detected Parameters
These are automatically calculated from your frame:
- **Screen Dimensions**: `screenWidth` × `screenHeight`
- **Frame Offset**: `frameOffsetX`, `frameOffsetY`
- **Optimal Rectangle**: Largest safe area within frame cutout

## ⚡ Performance Features

### Batch Processing
- **Concurrent Frame Generation**: Processes 4 frames simultaneously
- **40% Faster**: Significant performance improvement over sequential processing
- **Progress Logging**: Real-time batch progress reporting
- **Memory Safety**: 4096px maximum dimension limit for stability

### Optimized Settings
- **PNG Compression**: Balanced level 6 compression for speed
- **Quality Settings**: 95% quality for high-definition output
- **Fast Shrink**: Optimized Sharp operations for large images
- **Progressive Encoding**: Disabled for faster processing

### Security & Limits
- **File Size Limits**: 50MB maximum upload size
- **Request Logging**: Performance monitoring with response times
- **Memory Protection**: Dimension validation prevents memory exhaustion
- **Security Headers**: Express signature removal and payload limits

### Concurrent Request Handling
- **Multiple Users**: Handles simultaneous video generation requests
- **Isolated Sessions**: Each request gets its own temporary directory
- **Comprehensive Cleanup**: Files cleaned after success, errors, and exceptions

## 🛠️ Technical Requirements

### System Requirements
- **Node.js**: v18+ (tested with v22.18.0)
- **FFmpeg**: Required for video generation
- **Memory**: 2GB+ RAM recommended for large images

### Dependencies
- **Express**: Web server framework
- **Sharp**: High-performance image processing
- **Multer**: File upload handling
- **Rimraf**: Directory cleanup utilities

### Development Tools
```bash
npm start          # Start production server
npm run dev        # Start with auto-reload
npm run lint       # Check code style
npm run lint:fix   # Fix code style issues
npm run docs       # Generate JSDoc documentation
```

## 🧪 Testing

### Sample Test File
The project includes `fullpage.jpeg` as a sample test file:

| Property | Value |
|----------|-------|
| **Filename** | `fullpage.jpeg` |
| **Dimensions** | 780×3618 pixels |
| **File Size** | ~3.2MB |
| **Type** | Long webpage screenshot |
| **Aspect Ratio** | 1:4.6 (tall format) |
| **Purpose** | Testing, demonstration, and development |

### Quick Test Commands

```bash
# Start the server
npm start

# In another terminal - Quick test (2 seconds, 10fps)
curl -X POST http://localhost:3000/render \
  -F "page=@fullpage.jpeg" \
  -F "duration=2" \
  -F "fps=10" \
  --output quick-test.mp4

# Quality test (5 seconds, 30fps)
curl -X POST http://localhost:3000/render \
  -F "page=@fullpage.jpeg" \
  -F "duration=5" \
  -F "fps=30" \
  --output quality-test.mp4

# Performance test (1 second, 60fps)
curl -X POST http://localhost:3000/render \
  -F "page=@fullpage.jpeg" \
  -F "duration=1" \
  -F "fps=60" \
  --output performance-test.mp4
```

### Expected Results
- **Processing Time**: ~2-4 seconds for typical tests
- **Output Size**: ~1-3MB depending on duration and fps
- **Quality**: High-definition scrolling animation
- **Cleanup**: All temporary files automatically removed

## 📊 Monitoring & Health Checks

### Health Endpoint
The server provides a comprehensive health check endpoint:

```bash
GET /health
```

**Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "version": "1.0.0",
  "node": "v22.18.0",
  "uptime": 3600.5,
  "memory": {
    "rss": 45678912,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  }
}
```

**Response (Unhealthy):**
```json
{
  "status": "unhealthy",
  "error": "Default frame not found",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Request Logging
All requests are automatically logged with performance metrics:
```
POST /render - 200 (2847ms)
GET /health - 200 (3ms)
```

## 📚 API Documentation (JSDoc)

### Generating Documentation

The project includes comprehensive JSDoc documentation for all functions and APIs:

```bash
# Generate documentation
npm run docs
```

### Accessing Documentation

After generation, documentation is available by opening `docs/index.html` in your browser.

### Documentation Features

- **Complete API Reference**: All functions, parameters, and return types
- **Interactive Navigation**: Browse by modules, classes, and functions
- **Code Examples**: Usage examples for key functions
- **Type Information**: Detailed parameter and return type documentation
- **Algorithm Explanations**: Step-by-step process documentation

### Key Documented Functions

- **`detectTransparentCutout()`**: Frame analysis and cutout detection
- **`runFFmpeg()`**: Video generation with FFmpeg
- **`performJobCleanup()`**: Comprehensive cleanup system
- **`ensureTmp()`**: Directory management
- **Express Routes**: `/render` and `/health` endpoints

### Documentation Files

The generated documentation includes:

- **`docs/index.html`**: Main documentation homepage
- **`docs/global.html`**: Global functions and variables
- **`docs/server.js.html`**: Source code with syntax highlighting
- **`docs/styles/`**: CSS styling for documentation
- **`docs/scripts/`**: JavaScript for interactive features

### Configuration

JSDoc configuration is managed in `jsdoc.json`:
- **Source Files**: `server.js` (JavaScript files only)
- **Output Directory**: `docs/`
- **Plugins**: Markdown support enabled
- **Exclusions**: `node_modules/`, `tmp/`, `docs/` directories

> **Note**: The `docs/` directory is automatically excluded from Git via `.gitignore` since documentation should be generated fresh from the source code.

## 📱 Frame Requirements

For optimal auto-detection results:

### Frame Image Specifications
- **Format**: PNG with alpha channel (RGBA)
- **Cutout Area**: Must be fully transparent (alpha = 0)
- **Frame Area**: Should be opaque around the cutout
- **Translucent Areas**: Excluded from detection (alpha > 0 but < 255)

### Supported Frame Types
- **Rectangular**: Full transparent area utilization
- **Rounded Corners**: Conservative safe area detection
- **Custom Shapes**: Any transparent cutout pattern

### Default Frame
The included `defaultFrame.png` is a high-resolution rectangular frame (818×1784) optimized for quality and performance.

## 🔧 Configuration

### Environment Variables
```bash
PORT=3000                    # Server port (default: 3000)
NODE_ENV=production          # Environment mode
```

### Server Configuration
The server automatically:
- Creates `tmp/` and `tmp/uploads/` directories
- Removes temporary files after video delivery (success or failure)
- Handles concurrent requests with isolated sessions
- Comprehensive cleanup for all scenarios: success, errors, exceptions, and client disconnects

### Customization
- **Batch Size**: Modify `BATCH_SIZE` in server.js (default: 4)
- **Default Frame**: Replace `defaultFrame.png` with your preferred frame
- **Cleanup Behavior**: Comprehensive cleanup for all success/error scenarios

## 🚨 Error Handling & Troubleshooting

### Comprehensive Error Cleanup
The server handles all failure scenarios with automatic cleanup:

| Scenario | Cleanup Trigger | Files Cleaned |
|----------|----------------|---------------|
| **Successful Delivery** | `res.on('finish')` | Session dir + uploads |
| **Render Errors** | `catch` block | Session dir + uploads |
| **Response Errors** | `res.on('error')` | Session dir + uploads |
| **Client Disconnect** | `res.on('close')` | Session dir + uploads |
| **Server Exceptions** | `process.on('uncaughtException')` | All tmp files |
| **Unhandled Rejections** | `process.on('unhandledRejection')` | Logged only |

### Common Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| "No transparent cutout detected" | Frame lacks alpha channel | Use PNG with transparency |
| "Auto-detection failed" | Invalid frame format | Ensure RGBA format |
| "FFmpeg not found" | Missing FFmpeg | Install FFmpeg system-wide |
| "Out of memory" | Large images | Reduce image size or increase RAM |

### Fallback Behavior
The server gracefully handles errors by:
- **Immediate Cleanup**: All temporary files removed on any failure
- **Detailed Logging**: Error messages with job IDs for tracking
- **Graceful Degradation**: Server continues running after individual job failures
- **Emergency Cleanup**: Process-level handlers for catastrophic failures

## 📊 Example Usage & Output

### Successful Processing Log
```
No frame provided, using default defaultFrame.png
Auto-detecting transparent cutout in frame image...
Fully transparent area bounding box: 781x1745 at (19, 20)
Frame type: RECTANGULAR
Using full bounding box for rectangular frame: 780x1744 at (19, 20)
Detected cutout: 780x1744 at offset (19, 20)
Generated frames 1-4 of 36
Generated frames 5-8 of 36
...
Generated frames 33-36 of 36
Cleaning up session directory: job_1758349793301
Cleanup completed for job_1758349793301
```

### What This Shows
1. **Frame Detection**: Automatically uses default frame and detects type
2. **Cutout Analysis**: Finds optimal screen area (780×1744 pixels)
3. **Batch Processing**: Generates frames in groups of 4 for efficiency
4. **Comprehensive Cleanup**: Files removed after delivery (success or failure)

## 🤝 Contributing

### Development Setup
```bash
git clone <repository-url>
cd scroll-video-generator
npm install
npm run dev  # Start with auto-reload
```

### Code Quality
- **ESLint**: Strict linting rules enforced
- **Documentation**: 100% JSDoc coverage
- **Testing**: Run `npm run lint` before commits

### Architecture
- **Concurrent Safe**: Handles multiple simultaneous requests
- **Memory Efficient**: Optimized image processing pipeline with dimension limits
- **Self-Cleaning**: Automatic temporary file management
- **Performance Monitored**: Request logging with response times

## 🚀 Performance Benchmarks

### Typical Performance Metrics
- **Health Check**: ~3-5ms response time
- **Video Generation**: ~2-3 seconds for 2-second video (10fps)
- **Memory Usage**: ~45-60MB RSS during processing
- **Concurrent Requests**: Tested with multiple simultaneous users

### Optimization Features
- **Batch Processing**: 4 concurrent frame operations
- **Smart Compression**: Balanced PNG settings (level 6, 95% quality)
- **Memory Safety**: 4096px dimension limits prevent memory exhaustion
- **Fast Shrink**: Optimized Sharp operations for large images
- **Request Limits**: 50MB upload limit for stability

## 📄 License

This project is licensed under the ISC License.

## 🙋‍♂️ Support

For issues, questions, or contributions, please refer to the project repository.
