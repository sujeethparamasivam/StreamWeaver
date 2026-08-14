# StreamWeaver Performance Testing Guide

This guide explains how to test StreamWeaver's streaming and memory management capabilities with large datasets.

## Quick Start

### 1. Generate Test Data

Generate a test CSV file with your desired number of rows (uses streaming, doesn't buffer entire file):

```bash
# 100,000 rows (~25 MB)
node scripts/generate-test-csv.js --rows 100000

# 1,000,000 rows (~250 MB)
node scripts/generate-test-csv.js --rows 1000000

# 5,000,000 rows (~1.2 GB)
node scripts/generate-test-csv.js --rows 5000000

# 10,000,000 rows (~2.4 GB)
node scripts/generate-test-csv.js --rows 10000000 --output tmp/test-data-10m.csv
```

The generator will:
- ✓ Stream data to disk (not buffering entire file)
- ✓ Show real-time progress
- ✓ Report final file size and generation time

### 2. Start the Application

```bash
npm run dev
```

This starts:
- **Client**: Vite dev server on http://localhost:5176
- **Server**: Express API on http://localhost:5000
- **WebSocket**: Socket.IO for live progress updates

### 3. Upload and Process

1. Open http://localhost:5176 in your browser
2. Go to the **Upload** page
3. Select the generated CSV file
4. Watch live progress metrics:
   - Progress percentage
   - Rows processed
   - Rows/sec throughput
   - Memory usage (RSS, Heap)

5. After upload completes, go to **Mapping** page to define transformations
6. Click **Run Transformation** to apply any custom JavaScript transforms
7. View **Preview** with virtualized display of transformed rows
8. Check **Memory Audit** to see peak/average memory usage during processing

## Performance Metrics to Record

After each test, document these metrics:

```
File Size              : _____ MB
Row Count            : _____ rows
Upload Duration      : _____ seconds
Transform Duration   : _____ seconds
Import Duration      : _____ seconds
Total Duration       : _____ seconds

Rows/Sec (Upload)    : _____ rows/sec
Rows/Sec (Transform) : _____ rows/sec
Rows/Sec (Import)    : _____ rows/sec

Peak RSS             : _____ MB
Peak Heap            : _____ MB
Average RSS          : _____ MB
Average Heap         : _____ MB

Failed Rows          : _____
Successful Rows      : _____

Memory Audit Result  : PASS / FAIL
```

## Memory Target

**Specification Target:**
- File Size: 2 GB
- Peak Server RAM (RSS): **≤ 150 MB**
- Batch Size: 5,000 records

**How to Verify:**

1. During upload, the WebSocket will emit real-time memory samples
2. After upload, go to **Audit** page
3. Click **Memory Audit** to see:
   - Peak RSS
   - Peak Heap
   - Average RSS
   - Samples collected
   - PASS/FAIL badge based on `MEMORY_AUDIT_LIMIT_MB` (default 150 MB)

4. The audit page displays:
   - Raw memory measurements (not hard-coded)
   - Sparkline chart of memory usage over time
   - Actual samples from process.memoryUsage()

## Configuration for Testing

Edit `server/.env` to adjust:

```env
# Batch size for database writes (default 5000)
UPLOAD_BATCH_SIZE=5000

# Memory limit threshold for audit (default 150 MB)
MEMORY_AUDIT_LIMIT_MB=150

# Progress event throttle (default 300ms)
PROGRESS_THROTTLE_MS=300

# Database URI (leave empty for in-memory MongoDB)
MONGO_URI=
```

## Example Test Scenarios

### Scenario 1: Baseline (100K rows, ~25 MB)
```bash
node scripts/generate-test-csv.js --rows 100000
```
**Expected Results:**
- Upload: < 5 seconds
- Peak Memory: 20-40 MB
- Status: PASS (well below 150 MB)

### Scenario 2: Medium Load (1M rows, ~250 MB)
```bash
node scripts/generate-test-csv.js --rows 1000000
```
**Expected Results:**
- Upload: 15-30 seconds
- Peak Memory: 60-90 MB
- Status: PASS

### Scenario 3: Large Load (5M rows, ~1.2 GB)
```bash
node scripts/generate-test-csv.js --rows 5000000
```
**Expected Results:**
- Upload: 60-120 seconds
- Peak Memory: 100-130 MB
- Status: PASS

### Scenario 4: Very Large (10M rows, ~2.4 GB) - Stress Test
```bash
node scripts/generate-test-csv.js --rows 10000000 --output tmp/test-data-10m.csv
```
**Expected Results:**
- Upload: 120-240 seconds
- Peak Memory: 120-150 MB
- Status: Should still PASS at 150 MB limit

## Interpreting Results

### ✅ Good Performance
- Memory usage stays constant despite file size
- Peak RSS significantly below 150 MB limit
- Rows/sec is consistent (not degrading over time)
- No errors in validation or transformation

### ⚠️ Warning Signs
- Memory usage grows over time (indicates buffering)
- Peak RSS approaches or exceeds 150 MB
- Rows/sec decreases significantly as file grows
- High error rate suggests validation issues

### ❌ Failure Indicators
- Peak RSS exceeds 150 MB limit
- Server crashes or runs out of memory
- WebSocket progress stops updating
- Application hangs during processing

## Advanced Testing

### Testing Custom Transformations

1. Upload CSV
2. On **Mapping** page, add a transformation:
   ```javascript
   return value.toUpperCase();
   ```
3. Click **Run Transformation**
4. Record transformation duration and memory usage

### Testing Validation

The system automatically validates:
- Empty fields (warning)
- Invalid emails (warning)
- Invalid dates (warning)
- Missing name fields (warning)

View results on **Validation** page after upload.

### Testing with Real MongoDB

To test against a real MongoDB instance:

1. Update `server/.env`:
   ```env
   MONGO_URI=mongodb://username:password@host:27017/streamweaver
   ```

2. Restart server:
   ```bash
   npm run dev
   ```

3. Run upload test
4. Data will be persisted in MongoDB (check import history survives restarts)

## Troubleshooting

### WebSocket Connection Issues
- Check browser console for errors
- Verify server is running on port 5000
- Check CORS configuration in `server/src/server.ts`

### Memory Audit Shows No Data
- Upload must complete successfully (status: completed)
- MemorySample records are written during upload
- If upload failed, audit will be empty

### File Upload Fails
- Check file size (files > 5GB may have issues)
- Verify file format is CSV/JSON/Excel
- Check `server/uploads/` directory exists and is writable
- Look for error messages in browser dev console

### Rows/Sec is Very Low
- Normal for initial batches while database connection established
- Should stabilize after first 10-20 seconds
- Very low rates may indicate database connection issues

## Documentation Format

Create a `PERFORMANCE_RESULTS.md` file in the project root to document your tests:

```markdown
# StreamWeaver Performance Test Results

## Test 1: 100K Rows (Baseline)
- **Date:** 2025-08-14
- **File Size:** 25 MB
- **Test Duration:** 45 seconds
- **Upload Time:** 4.2 sec | 23,809 rows/sec
- **Memory Peak:** 35 MB RSS, 22 MB Heap
- **Result:** ✅ PASS

## Test 2: 1M Rows (Medium Load)
- **Date:** 2025-08-14
- **File Size:** 250 MB
- **Test Duration:** 180 seconds
- **Upload Time:** 28.5 sec | 35,087 rows/sec
- **Memory Peak:** 78 MB RSS, 45 MB Heap
- **Result:** ✅ PASS

...
```

## Performance Optimization Tips

If memory usage is higher than expected:

1. **Reduce batch size** (if not using 5000):
   ```env
   UPLOAD_BATCH_SIZE=2500
   ```

2. **Increase progress throttle** (fewer event emissions):
   ```env
   PROGRESS_THROTTLE_MS=500
   ```

3. **Disable memory sampling** (during test, then re-enable):
   - Comment out `scheduleMemorySample()` in uploadRoutes.ts temporarily
   - Warning: Memory audit won't work without sampling

4. **Use leaner row structure**:
   - Remove unnecessary fields from CSV
   - Reduces object size in memory

## Next Steps

After completing these tests:
1. Document results in PERFORMANCE_RESULTS.md
2. Compare against 150 MB specification target
3. If results meet spec, deployment is ready for production
4. If results exceed spec, investigate and optimize further

