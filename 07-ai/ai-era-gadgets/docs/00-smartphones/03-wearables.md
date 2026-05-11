# Wearables — Apple Watch / Galaxy Watch, Health Monitoring, AI Fitness

> This guide covers AI applications in wearable devices, primarily smartwatches. It covers everything from sensor data acquisition to health monitoring, AI fitness coaching, and development methodologies.

---

## What You Will Learn in This Chapter

1. **Wearable Sensor Technology** — How sensors work and their accuracy, including optical heart rate, accelerometer, and blood oxygen sensors
2. **Health Monitoring AI** — Algorithms for arrhythmia detection, sleep analysis, and stress estimation
3. **AI Fitness Development** — App development using HealthKit/Health Connect APIs


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [AI Assistants — Siri / Google Assistant / Alexa and LLM Integration](./02-ai-assistants.md)

---

## 1. Wearable Sensor Architecture

```
┌─────────────────────────────────────────────────┐
│          Smartwatch Sensor Architecture            │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ PPG (Optical) │  │ ECG          │              │
│  │ Heart Rate    │  │ Arrhythmia   │              │
│  │ SpO2 (Blood O2)│ │ Atrial Fib.  │              │
│  └──────────────┘  └──────────────┘              │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Accelerometer │  │ Gyroscope    │              │
│  │ Steps/Fall Det│  │ Posture Est. │              │
│  │ Sleep Stages  │  │ Workout      │              │
│  └──────────────┘  └──────────────┘              │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Barometer     │  │ Temp Sensor  │              │
│  │ Altitude/     │  │ Skin Temp    │              │
│  │ Stair Detect. │  │              │              │
│  └──────────────┘  └──────────────┘              │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ GPS          │  │ NPU (select  │              │
│  │ Location/    │  │ models)      │              │
│  │ Route        │  │ On-device AI │              │
│  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────┘
```

### 1.1 How PPG (Photoplethysmography) Sensors Work

PPG (Photoplethysmography) is the foundational technology for heart rate measurement in wearables. It shines green LEDs onto the skin and detects variations in light absorption caused by changes in blood vessel volume.

```
┌─────────────────────────────────────────────────┐
│          PPG Sensor Operating Principle            │
│                                                   │
│  ┌───────────────────────────────┐               │
│  │      Skin Surface              │               │
│  │  ←←← Reflected Light (Photodiode Detection)   │
│  │                                │               │
│  │  LED(Green/Red/IR) ───→ Emitted Light          │
│  │       │                        │               │
│  │       ▼                        │               │
│  │  ┌─────────────┐              │               │
│  │  │ Capillaries  │              │               │
│  │  │ Blood Volume │              │               │
│  │  │ Change       │              │               │
│  │  │ ↕ Constrict/ │              │               │
│  │  │   Dilate     │              │               │
│  │  └─────────────┘              │               │
│  └───────────────────────────────┘               │
│                                                   │
│  Green LED (525nm): Heart rate measurement         │
│  Red LED (660nm) + IR LED (940nm): SpO2 measurement│
│                                                   │
│  Heartbeat → Blood volume ↑ → Absorption ↑ → Signal ↓  │
│  Diastole  → Blood volume ↓ → Absorption ↓ → Signal ↑  │
│                                                   │
│  Signal Processing: Low-pass Filter → Peak Detection → BPM Calc │
└─────────────────────────────────────────────────┘
```

### 1.2 Health Data Processing Flow

```
┌─────────────────────────────────────────────────┐
│          Health Monitoring AI Pipeline             │
│                                                   │
│  Sensor Array                                     │
│  (PPG/Accel/Temp)                                 │
│      │                                            │
│      ▼                                            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Noise     │──▶│ Feature  │──▶│ On-device│     │
│  │ Removal   │   │ Extract  │   │ ML Infer │     │
│  │ Filter    │   │ (HRV etc)│   │ (Core ML)│     │
│  │ (Low-pass)│   │          │   │          │     │
│  └──────────┘   └──────────┘   └──────────┘     │
│                                       │           │
│                                       ▼           │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Alert     │◀──│ Trend    │◀──│ HealthKit│     │
│  │ Notif.   │   │ Analysis │   │ / Health │     │
│  │ (Anomaly)│   │ (Long-   │   │ Connect  │     │
│  │          │   │  term)   │   │          │     │
│  └──────────┘   └──────────┘   └──────────┘     │
└─────────────────────────────────────────────────┘
```

### 1.3 Body Composition Measurement via BIA (Bioelectrical Impedance Analysis)

The BIA sensor built into the Galaxy Watch estimates body composition by passing a weak electrical current through the body and measuring electrical resistance.

```
┌─────────────────────────────────────────────────┐
│          BIA Body Composition Analysis Flow        │
│                                                   │
│  Step 1: Electrode Contact                        │
│  ┌─────────────┐                                 │
│  │ Back electrodes│ ── Weak AC current (50kHz) ── │
│  │ (2 points)    │                    │           │
│  │ Wrist contact │                    │           │
│  └─────────────┘                    │           │
│                                      │           │
│  Step 2: Receive on opposite electrode            │
│  ┌─────────────┐                    │           │
│  │ Side button   │ ◀── Current received ──┘       │
│  │ (touch with  │                                │
│  │  finger)     │                                │
│  └─────────────┘                                │
│                                                   │
│  Step 3: Impedance Calculation                    │
│  Z = V / I (Voltage / Current)                    │
│                                                   │
│  Step 4: Body Composition Estimation              │
│  ┌──────────────────────────────┐               │
│  │ Body Fat % = f(Z, Height, Weight, Age, Sex)   │
│  │ Skeletal Muscle = f(Z, Height, Weight)        │
│  │ Basal Metabolism = f(Skeletal Muscle, Body Fat%)│
│  │ Body Water = f(Z, Height)                     │
│  └──────────────────────────────┘               │
│                                                   │
│  Limitations:                                     │
│  - Accuracy decreases after meals or exercise     │
│  - Not usable by pacemaker wearers               │
│  - ±3-5% compared to medical-grade DEXA scans    │
└─────────────────────────────────────────────────┘
```

---

## 2. Code Examples

### Code Example 1: Fetching Heart Rate Data with Apple HealthKit

```swift
import HealthKit

class HeartRateMonitor {
    let healthStore = HKHealthStore()

    func requestAuthorization() {
        let heartRateType = HKQuantityType.quantityType(
            forIdentifier: .heartRate)!
        let typesToRead: Set<HKSampleType> = [heartRateType]

        healthStore.requestAuthorization(
            toShare: nil, read: typesToRead
        ) { success, error in
            if success {
                print("HealthKit authorization successful")
                self.fetchRecentHeartRates()
            }
        }
    }

    func fetchRecentHeartRates() {
        let heartRateType = HKQuantityType.quantityType(
            forIdentifier: .heartRate)!

        // Fetch data from the last 24 hours
        let predicate = HKQuery.predicateForSamples(
            withStart: Date().addingTimeInterval(-86400),
            end: Date(), options: .strictEndDate
        )

        let query = HKSampleQuery(
            sampleType: heartRateType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [
                NSSortDescriptor(key: HKSampleSortIdentifierStartDate,
                               ascending: false)
            ]
        ) { _, samples, error in
            guard let samples = samples as? [HKQuantitySample] else { return }

            for sample in samples.prefix(10) {
                let bpm = sample.quantity.doubleValue(
                    for: HKUnit(from: "count/min"))
                let date = sample.startDate
                print("\(date): \(Int(bpm)) BPM")
            }

            // Anomaly detection
            let avgBPM = samples.map {
                $0.quantity.doubleValue(for: HKUnit(from: "count/min"))
            }.reduce(0, +) / Double(samples.count)

            if avgBPM > 100 {
                print("Resting heart rate is elevated: \(Int(avgBPM)) BPM")
            }
        }

        healthStore.execute(query)
    }
}
```

### Code Example 2: Fetching Step Data with Android Health Connect

```kotlin
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.temporal.ChronoUnit

suspend fun readStepsData(healthClient: HealthConnectClient) {
    val now = Instant.now()
    val startOfDay = now.truncatedTo(ChronoUnit.DAYS)

    val request = ReadRecordsRequest(
        recordType = StepsRecord::class,
        timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
    )

    val response = healthClient.readRecords(request)
    var totalSteps = 0L

    for (record in response.records) {
        totalSteps += record.count
        println("${record.startTime} - ${record.endTime}: ${record.count} steps")
    }

    println("Today's total: ${totalSteps} steps")

    // Goal achievement check
    val goal = 10000L
    val progress = (totalSteps.toFloat() / goal * 100).toInt()
    println("Goal progress: ${progress}% ($totalSteps / $goal)")

    if (totalSteps >= goal) {
        println("Congratulations on reaching your goal!")
    } else {
        println("${goal - totalSteps} more steps to go. Keep it up!")
    }
}
```

### Code Example 3: Stress Estimation via Heart Rate Variability (HRV) Analysis

```python
import numpy as np
from scipy import signal
from scipy.interpolate import interp1d

def analyze_hrv(rr_intervals_ms):
    """
    Calculate HRV metrics from RR intervals (heartbeat intervals) and estimate stress.
    rr_intervals_ms: List of consecutive RR intervals (in milliseconds)
    """
    rr = np.array(rr_intervals_ms)

    # --- Time-domain metrics ---
    mean_rr = np.mean(rr)
    sdnn = np.std(rr, ddof=1)  # Standard deviation of all RR intervals
    rmssd = np.sqrt(np.mean(np.diff(rr) ** 2))  # RMS of successive differences

    # --- Frequency-domain metrics ---
    # Interpolate RR intervals to uniform spacing
    cumulative_time = np.cumsum(rr) / 1000.0
    f_interp = interp1d(cumulative_time, rr, kind='cubic')
    fs = 4.0  # Resample at 4Hz
    t_uniform = np.arange(cumulative_time[0], cumulative_time[-1], 1/fs)
    rr_uniform = f_interp(t_uniform)

    # Power spectral density
    freqs, psd = signal.welch(rr_uniform, fs=fs, nperseg=256)

    # LF (0.04-0.15Hz): Sympathetic + Parasympathetic nervous system
    lf_mask = (freqs >= 0.04) & (freqs < 0.15)
    lf_power = np.trapz(psd[lf_mask], freqs[lf_mask])

    # HF (0.15-0.4Hz): Parasympathetic nervous system
    hf_mask = (freqs >= 0.15) & (freqs < 0.4)
    hf_power = np.trapz(psd[hf_mask], freqs[hf_mask])

    lf_hf_ratio = lf_power / hf_power if hf_power > 0 else float('inf')

    # --- Stress estimation ---
    # Low RMSSD + High LF/HF ratio → High stress
    if rmssd < 20 and lf_hf_ratio > 3.0:
        stress_level = "High"
    elif rmssd < 40 or lf_hf_ratio > 2.0:
        stress_level = "Medium"
    else:
        stress_level = "Low"

    return {
        "mean_hr": 60000 / mean_rr,
        "sdnn_ms": sdnn,
        "rmssd_ms": rmssd,
        "lf_power": lf_power,
        "hf_power": hf_power,
        "lf_hf_ratio": lf_hf_ratio,
        "stress_level": stress_level
    }

# Usage example
rr_data = [820, 835, 790, 810, 845, 800, 815, 830, 795, 810]
result = analyze_hrv(rr_data)
print(f"Heart Rate: {result['mean_hr']:.0f} BPM")
print(f"RMSSD: {result['rmssd_ms']:.1f} ms")
print(f"LF/HF Ratio: {result['lf_hf_ratio']:.2f}")
print(f"Stress Level: {result['stress_level']}")
```

### Code Example 4: Estimating Sleep Stages from Accelerometer Data

```python
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

def extract_sleep_features(accel_data, window_sec=30, fs=50):
    """
    Extract sleep features from accelerometer data.
    accel_data: shape (N, 3) - x, y, z axis acceleration
    """
    window_size = window_sec * fs
    features_list = []

    for i in range(0, len(accel_data) - window_size, window_size):
        window = accel_data[i:i + window_size]
        magnitude = np.sqrt(np.sum(window**2, axis=1))

        features = {
            'mean_mag': np.mean(magnitude),
            'std_mag': np.std(magnitude),
            'max_mag': np.max(magnitude),
            'activity_count': np.sum(np.abs(np.diff(magnitude)) > 0.1),
            'zero_crossing': np.sum(np.diff(np.sign(magnitude - np.mean(magnitude))) != 0),
            'energy': np.sum(magnitude**2) / len(magnitude),
            'entropy': -np.sum(np.histogram(magnitude, bins=20, density=True)[0]
                              * np.log2(np.histogram(magnitude, bins=20, density=True)[0] + 1e-10))
        }
        features_list.append(features)

    return features_list

def classify_sleep_stages(features):
    """
    Sleep stage classification: Awake / Light Sleep / Deep Sleep / REM
    (Assumes a pre-trained model is used)
    """
    # Threshold-based simple classification
    stages = []
    for f in features:
        if f['activity_count'] > 50:
            stages.append('Awake')
        elif f['std_mag'] < 0.01:
            stages.append('Deep Sleep')
        elif f['zero_crossing'] > 30:
            stages.append('REM')
        else:
            stages.append('Light Sleep')
    return stages

# Usage example
accel = np.random.randn(50 * 3600 * 8, 3) * 0.05  # 8 hours of data
features = extract_sleep_features(accel)
stages = classify_sleep_stages(features)
print(f"Sleep stages: {len(stages)} epochs analyzed")
print(f"Deep Sleep: {stages.count('Deep Sleep')} epochs "
      f"({stages.count('Deep Sleep') / len(stages) * 100:.1f}%)")
```

### Code Example 5: watchOS — Workout Session Management

```swift
import HealthKit
import WatchKit

class WorkoutManager: NSObject, HKWorkoutSessionDelegate,
                      HKLiveWorkoutBuilderDelegate {

    let healthStore = HKHealthStore()
    var session: HKWorkoutSession?
    var builder: HKLiveWorkoutBuilder?

    func startRunningWorkout() {
        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor

        do {
            session = try HKWorkoutSession(
                healthStore: healthStore, configuration: config
            )
            builder = session?.associatedWorkoutBuilder()

            session?.delegate = self
            builder?.delegate = self

            builder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: config
            )

            let startDate = Date()
            session?.startActivity(with: startDate)
            builder?.beginCollection(withStart: startDate) { success, error in
                if success {
                    print("Workout started: Running")
                }
            }
        } catch {
            print("Error: \(error)")
        }
    }

    // Real-time data updates
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                       didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }

            if let stats = workoutBuilder.statistics(for: quantityType) {
                switch quantityType {
                case HKQuantityType.quantityType(forIdentifier: .heartRate):
                    let bpm = stats.mostRecentQuantity()?.doubleValue(
                        for: HKUnit(from: "count/min")) ?? 0
                    print("Heart Rate: \(Int(bpm)) BPM")

                    // AI zone determination
                    let zone = heartRateZone(bpm: bpm, maxHR: 190)
                    print("Zone: \(zone)")

                case HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning):
                    let km = stats.sumQuantity()?.doubleValue(
                        for: .meterUnit(with: .kilo)) ?? 0
                    print("Distance: \(String(format: "%.2f", km)) km")

                default: break
                }
            }
        }
    }

    func heartRateZone(bpm: Double, maxHR: Double) -> String {
        let percentage = bpm / maxHR * 100
        switch percentage {
        case ..<60: return "Zone 1 (Recovery)"
        case 60..<70: return "Zone 2 (Fat Burn)"
        case 70..<80: return "Zone 3 (Aerobic)"
        case 80..<90: return "Zone 4 (Anaerobic)"
        default: return "Zone 5 (Max)"
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession,
                       didChangeTo toState: HKWorkoutSessionState,
                       from fromState: HKWorkoutSessionState,
                       date: Date) {}
    func workoutSession(_ workoutSession: HKWorkoutSession,
                       didFailWithError error: Error) {}
}
```

### Code Example 6: HealthKit Background Delivery (Real-time Notifications)

By using HealthKit's background delivery feature, your app can be launched in the background to process data whenever new health data is recorded.

```swift
import HealthKit
import UserNotifications

class HealthBackgroundMonitor {
    let healthStore = HKHealthStore()

    /// Set up background delivery
    func enableBackgroundDelivery() {
        let heartRateType = HKQuantityType.quantityType(
            forIdentifier: .heartRate)!

        // Receive heart rate data updates in the background
        healthStore.enableBackgroundDelivery(
            for: heartRateType,
            frequency: .immediate  // Immediate notification
        ) { success, error in
            if success {
                print("Background delivery enabled successfully")
                self.setupObserverQuery()
            }
        }
    }

    /// Monitor for new data with an observer query
    func setupObserverQuery() {
        let heartRateType = HKQuantityType.quantityType(
            forIdentifier: .heartRate)!

        let query = HKObserverQuery(
            sampleType: heartRateType,
            predicate: nil
        ) { [weak self] query, completionHandler, error in
            // New heart rate data has been recorded
            self?.checkForAbnormalHeartRate()
            completionHandler()
        }

        healthStore.execute(query)
    }

    /// Detect abnormal heart rate and notify the user
    func checkForAbnormalHeartRate() {
        let heartRateType = HKQuantityType.quantityType(
            forIdentifier: .heartRate)!

        // Fetch data from the last 5 minutes
        let predicate = HKQuery.predicateForSamples(
            withStart: Date().addingTimeInterval(-300),
            end: Date(), options: .strictEndDate
        )

        let query = HKSampleQuery(
            sampleType: heartRateType,
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, _ in
            guard let samples = samples as? [HKQuantitySample],
                  !samples.isEmpty else { return }

            let bpmValues = samples.map {
                $0.quantity.doubleValue(for: HKUnit(from: "count/min"))
            }

            let avgBPM = bpmValues.reduce(0, +) / Double(bpmValues.count)
            let maxBPM = bpmValues.max() ?? 0
            let minBPM = bpmValues.min() ?? 0

            // Anomaly detection logic
            // 1. Resting tachycardia (above 100 BPM for over 5 minutes)
            if avgBPM > 100 {
                self.sendAlert(
                    title: "High Heart Rate Detected",
                    body: "Your resting heart rate is \(Int(avgBPM)) BPM. " +
                          "Please consult a healthcare provider if this persists."
                )
            }

            // 2. Bradycardia (below 40 BPM)
            if minBPM < 40 && minBPM > 0 {
                self.sendAlert(
                    title: "Low Heart Rate Detected",
                    body: "Your heart rate dropped to \(Int(minBPM)) BPM."
                )
            }

            // 3. Sudden change in heart rate variability
            if bpmValues.count >= 3 {
                let diffs = zip(bpmValues, bpmValues.dropFirst()).map {
                    abs($0.0 - $0.1)
                }
                let maxDiff = diffs.max() ?? 0
                if maxDiff > 30 {
                    self.sendAlert(
                        title: "Abnormal Heart Rate Variability",
                        body: "A variation of \(Int(maxDiff)) BPM was detected in a short period."
                    )
                }
            }
        }

        healthStore.execute(query)
    }

    func sendAlert(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil  // Immediate notification
        )

        UNUserNotificationCenter.current().add(request)
    }
}
```

### Code Example 7: Batch Processing with Core Motion (Gait Analysis AI)

```swift
import CoreMotion
import CoreML

class GaitAnalyzer {
    let motionManager = CMMotionManager()
    let pedometer = CMPedometer()
    var accelerometerBuffer: [(x: Double, y: Double, z: Double, t: Double)] = []

    /// Start batch collection of accelerometer data
    func startGaitCollection() {
        guard motionManager.isAccelerometerAvailable else { return }

        // Sample at 50Hz (considering battery efficiency)
        motionManager.accelerometerUpdateInterval = 1.0 / 50.0

        motionManager.startAccelerometerUpdates(to: .main) {
            [weak self] data, error in
            guard let data = data else { return }

            self?.accelerometerBuffer.append((
                x: data.acceleration.x,
                y: data.acceleration.y,
                z: data.acceleration.z,
                t: data.timestamp
            ))

            // Analyze when 10 seconds of data has accumulated
            if let self = self,
               self.accelerometerBuffer.count >= 500 {
                self.analyzeGait()
            }
        }
    }

    /// Gait pattern analysis
    func analyzeGait() {
        let buffer = accelerometerBuffer
        accelerometerBuffer.removeAll()

        // Feature calculation
        let magnitudes = buffer.map {
            sqrt($0.x * $0.x + $0.y * $0.y + $0.z * $0.z)
        }

        let mean = magnitudes.reduce(0, +) / Double(magnitudes.count)
        let variance = magnitudes.map { ($0 - mean) * ($0 - mean) }
            .reduce(0, +) / Double(magnitudes.count)
        let stdDev = sqrt(variance)

        // Step detection (zero-crossing method)
        let detrended = magnitudes.map { $0 - mean }
        var stepCount = 0
        for i in 1..<detrended.count {
            if detrended[i-1] < 0 && detrended[i] >= 0 {
                stepCount += 1
            }
        }

        // Gait symmetry calculation
        let halfLen = magnitudes.count / 2
        let firstHalf = Array(magnitudes[..<halfLen])
        let secondHalf = Array(magnitudes[halfLen...])
        let symmetryScore = calculateSymmetry(firstHalf, secondHalf)

        // Gait quality score
        let gaitScore = evaluateGaitQuality(
            stepRegularity: stdDev,
            symmetry: symmetryScore,
            cadence: Double(stepCount) * 6.0  // 10 seconds → per minute
        )

        print("Steps (10 sec): \(stepCount)")
        print("Cadence: \(stepCount * 6) steps/min")
        print("Symmetry Score: \(String(format: "%.2f", symmetryScore))")
        print("Gait Quality Score: \(String(format: "%.0f", gaitScore))/100")
    }

    func calculateSymmetry(_ a: [Double], _ b: [Double]) -> Double {
        let minLen = min(a.count, b.count)
        var correlation = 0.0
        let meanA = a.prefix(minLen).reduce(0, +) / Double(minLen)
        let meanB = b.prefix(minLen).reduce(0, +) / Double(minLen)

        var numerator = 0.0
        var denomA = 0.0
        var denomB = 0.0

        for i in 0..<minLen {
            let da = a[i] - meanA
            let db = b[i] - meanB
            numerator += da * db
            denomA += da * da
            denomB += db * db
        }

        let denom = sqrt(denomA * denomB)
        return denom > 0 ? numerator / denom : 0
    }

    func evaluateGaitQuality(stepRegularity: Double,
                             symmetry: Double,
                             cadence: Double) -> Double {
        // Normal range: cadence 100-130, symmetry 0.8+
        var score = 100.0

        if cadence < 80 || cadence > 150 {
            score -= 20  // Abnormal cadence
        }
        if symmetry < 0.7 {
            score -= 30  // Asymmetric gait
        } else if symmetry < 0.85 {
            score -= 15
        }
        if stepRegularity > 0.3 {
            score -= 15  // Irregular gait
        }

        return max(0, min(100, score))
    }
}
```

### Code Example 8: Writing and Analyzing Sleep Data with Health Connect

```kotlin
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SleepStageRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.ZoneOffset
import java.time.LocalDate
import java.time.Duration

class SleepAnalyzer(private val healthClient: HealthConnectClient) {

    /**
     * Record a sleep session
     */
    suspend fun recordSleepSession(
        startTime: Instant,
        endTime: Instant,
        stages: List<Pair<Instant, SleepStageRecord.StageType>>
    ) {
        // Create sleep stage records
        val stageRecords = stages.zipWithNext().map { (current, next) ->
            SleepStageRecord(
                startTime = current.first,
                startZoneOffset = ZoneOffset.ofHours(9),
                endTime = next.first,
                endZoneOffset = ZoneOffset.ofHours(9),
                stage = current.second
            )
        }

        // Create sleep session record
        val sessionRecord = SleepSessionRecord(
            startTime = startTime,
            startZoneOffset = ZoneOffset.ofHours(9),
            endTime = endTime,
            endZoneOffset = ZoneOffset.ofHours(9),
            stages = stageRecords.map {
                SleepSessionRecord.Stage(
                    startTime = it.startTime,
                    endTime = it.endTime,
                    stage = when (it.stage) {
                        SleepStageRecord.StageType.AWAKE ->
                            SleepSessionRecord.STAGE_TYPE_AWAKE
                        SleepStageRecord.StageType.LIGHT ->
                            SleepSessionRecord.STAGE_TYPE_LIGHT
                        SleepStageRecord.StageType.DEEP ->
                            SleepSessionRecord.STAGE_TYPE_DEEP
                        SleepStageRecord.StageType.REM ->
                            SleepSessionRecord.STAGE_TYPE_REM
                        else -> SleepSessionRecord.STAGE_TYPE_UNKNOWN
                    }
                )
            }
        )

        healthClient.insertRecords(listOf(sessionRecord))
        println("Sleep session recorded")
    }

    /**
     * Sleep analysis report for the past 7 days
     */
    suspend fun generateWeeklySleepReport(): SleepReport {
        val now = Instant.now()
        val weekAgo = now.minus(Duration.ofDays(7))

        val request = ReadRecordsRequest(
            recordType = SleepSessionRecord::class,
            timeRangeFilter = TimeRangeFilter.between(weekAgo, now)
        )

        val sessions = healthClient.readRecords(request).records

        val dailyStats = sessions.map { session ->
            val duration = Duration.between(session.startTime, session.endTime)
            val stages = session.stages

            val deepSleep = stages
                .filter { it.stage == SleepSessionRecord.STAGE_TYPE_DEEP }
                .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }

            val remSleep = stages
                .filter { it.stage == SleepSessionRecord.STAGE_TYPE_REM }
                .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }

            val awakeTime = stages
                .filter { it.stage == SleepSessionRecord.STAGE_TYPE_AWAKE }
                .sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }

            DailySleep(
                date = session.startTime,
                totalMinutes = duration.toMinutes(),
                deepMinutes = deepSleep,
                remMinutes = remSleep,
                awakeMinutes = awakeTime,
                sleepEfficiency = ((duration.toMinutes() - awakeTime).toFloat()
                    / duration.toMinutes() * 100)
            )
        }

        return SleepReport(
            averageDuration = dailyStats.map { it.totalMinutes }.average(),
            averageDeepSleep = dailyStats.map { it.deepMinutes }.average(),
            averageRemSleep = dailyStats.map { it.remMinutes }.average(),
            averageEfficiency = dailyStats.map { it.sleepEfficiency.toDouble() }.average(),
            sleepScore = calculateSleepScore(dailyStats),
            recommendation = generateRecommendation(dailyStats)
        )
    }

    private fun calculateSleepScore(stats: List<DailySleep>): Int {
        var score = 100
        val avgDuration = stats.map { it.totalMinutes }.average()
        val avgEfficiency = stats.map { it.sleepEfficiency.toDouble() }.average()
        val avgDeep = stats.map { it.deepMinutes }.average()

        // Sleep duration: 7-9 hours is ideal
        if (avgDuration < 360) score -= 25       // Less than 6 hours
        else if (avgDuration < 420) score -= 10  // 6-7 hours
        else if (avgDuration > 600) score -= 5   // Over 10 hours

        // Sleep efficiency: 85% or above is ideal
        if (avgEfficiency < 75) score -= 20
        else if (avgEfficiency < 85) score -= 10

        // Deep sleep: 15-25% of total sleep time is ideal
        val deepRatio = avgDeep / avgDuration * 100
        if (deepRatio < 10) score -= 15
        else if (deepRatio < 15) score -= 5

        return score.coerceIn(0, 100)
    }

    private fun generateRecommendation(stats: List<DailySleep>): String {
        val avgDuration = stats.map { it.totalMinutes }.average()
        val avgDeep = stats.map { it.deepMinutes }.average()

        return when {
            avgDuration < 360 -> "Your sleep duration is insufficient. We recommend going to bed 30 minutes earlier."
            avgDeep < avgDuration * 0.10 -> "Your deep sleep is below average. Try reducing caffeine and screen time before bed."
            else -> "You have a healthy sleep pattern. Keep up the good work."
        }
    }
}

data class DailySleep(
    val date: Instant,
    val totalMinutes: Long,
    val deepMinutes: Long,
    val remMinutes: Long,
    val awakeMinutes: Long,
    val sleepEfficiency: Float
)

data class SleepReport(
    val averageDuration: Double,
    val averageDeepSleep: Double,
    val averageRemSleep: Double,
    val averageEfficiency: Double,
    val sleepScore: Int,
    val recommendation: String
)
```

---

## 3. Comparison Tables

### Comparison Table 1: Major Smartwatch Comparison

| Item | Apple Watch Ultra 2 | Galaxy Watch 6 Classic | Garmin Fenix 8 | Pixel Watch 3 |
|------|-------------------|---------------------|---------------|-------------|
| OS | watchOS 11 | Wear OS 5 | Garmin OS | Wear OS 5 |
| Sensors | PPG, ECG, SpO2, Temp | PPG, ECG, BIA, SpO2 | PPG, SpO2 | PPG, ECG, SpO2 |
| NPU | S9 SiP | Exynos W940 | None | Tensor-equipped |
| Battery | 36 hours | 40 hours | 28 days | 24 hours |
| Sleep Analysis | Sleep Stages + Breathing | Sleep Score + Snoring | Advanced Sleep | Sleep Stages |
| AI Features | Double Tap, Siri | Galaxy AI, BIA Analysis | Training Readiness | Fitbit AI |
| Price Range | From 128,800 JPY | From 52,800 JPY | From 139,800 JPY | From 52,800 JPY |

### Comparison Table 2: Health Monitoring Accuracy

| Metric | Measurement Principle | Accuracy (vs. Clinical) | Limitations |
|------|---------|-------------|---------|
| Heart Rate (PPG) | Optical (Green LED) | ±2-5 BPM | Accuracy decreases during exercise |
| ECG | Electrical Signal | Near medical-grade | Atrial fibrillation detection only |
| SpO2 (Blood Oxygen) | Red/IR LED | ±2-3% | Lower accuracy on darker skin tones |
| Body Composition (BIA) | Bioelectrical Impedance | ±3-5% body fat | Galaxy Watch only |
| Skin Temperature | Infrared | ±0.1°C | Affected by ambient temperature |
| Sleep Stages | Accelerometer + Heart Rate | 70-80% agreement vs. PSG | Lower for people who move less in sleep |

### Comparison Table 3: Development Platform Comparison

| Item | watchOS (Apple) | Wear OS (Google) | Tizen (Samsung legacy) | Garmin SDK |
|------|----------------|-----------------|------------------|-----------|
| Language | Swift | Kotlin | C/C++ | Monkey C |
| Health API | HealthKit | Health Connect | Samsung Health SDK | Garmin Health SDK |
| ML Inference | Core ML | TFLite | TFLite | None |
| UI Framework | SwiftUI | Jetpack Compose | EFL | Garmin UI |
| Background | Background Delivery | WorkManager | Background Service | None (heavily restricted) |
| Sensor Access | Core Motion | SensorManager | Sensor API | Sensor API |
| Complications | ClockKit | Tiles API | Watchface Studio | Data Fields |
| Debugging | Xcode + Simulator | Android Studio | Tizen Studio | Garmin Simulator |
| Store Distribution | App Store | Google Play | Galaxy Store | Connect IQ Store |

### Comparison Table 4: Clinical Significance of HRV Metrics

| HRV Metric | Calculation Method | Normal Range | Clinical Significance | Wearable Support |
|----------|---------|---------|-----------|---------------|
| RMSSD | RMS of successive RR differences | 20-100 ms | Indicator of parasympathetic activity | Apple Watch, Oura |
| SDNN | Standard deviation of RR intervals | 50-150 ms | Overall autonomic nervous system variability | Garmin, Whoop |
| LF/HF Ratio | Low frequency / High frequency ratio | 1.0-3.0 | Sympathetic/parasympathetic balance | Requires calculation |
| pNN50 | Percentage of differences > 50ms | 5-40% | Parasympathetic tone | Apple Watch |
| DFA alpha1 | Detrended Fluctuation Analysis | 0.75-1.0 | Exercise intensity indicator | Garmin (select models) |

---

## 4. Use Cases

### Use Case 1: Early Detection of Arrhythmia (Atrial Fibrillation)

Apple Watch's ECG feature and irregular rhythm notification are approved by the FDA (U.S. Food and Drug Administration) and Japan's PMDA (Pharmaceuticals and Medical Devices Agency). In the Stanford Apple Heart Study (2019), irregular rhythms were detected in 0.52% of 419,297 participants, and 34% of those were diagnosed with atrial fibrillation.

```
┌─────────────────────────────────────────────────┐
│          Atrial Fibrillation Detection Flow        │
│                                                   │
│  Continuous Monitoring                            │
│  PPG Signal → Irregular Rhythm Detection AI       │
│       │                                           │
│       ├── Normal → No action                      │
│       │                                           │
│       └── Irregularity Detected → Notification    │
│                │                                   │
│                ▼                                   │
│  User records ECG (30 seconds)                    │
│       │                                           │
│       ├── Sinus Rhythm → "Normal heart rhythm"    │
│       ├── AFib → "Signs of atrial fibrillation"   │
│       └── Inconclusive → "Re-measurement recommended" │
│                │                                   │
│                ▼                                   │
│  PDF Report Generation → Share with physician     │
└─────────────────────────────────────────────────┘
```

**Key Considerations for Developers:**
- Apple Watch ECG is a screening tool that "suggests the possibility of atrial fibrillation" and cannot provide a definitive diagnosis
- Understand the scope of medical device certification and avoid expressions that imply medical diagnosis within the app
- Must comply with medical device regulations in each country (FDA 510(k), CE marking, PMDA approval)

### Use Case 2: AI Fitness Coaching

An implementation pattern for a personalized training recommendation system leveraging wearable data.

```python
class AIFitnessCoach:
    """
    AI fitness coach based on wearable data.
    Recommends optimal training based on heart rate zones, HRV, and sleep score.
    """
    def __init__(self, user_profile):
        self.max_hr = 220 - user_profile['age']  # Estimated max heart rate
        self.resting_hr = user_profile.get('resting_hr', 60)
        self.fitness_level = user_profile.get('fitness_level', 'intermediate')

    def calculate_training_readiness(self, hrv_rmssd, sleep_score,
                                      previous_training_load):
        """
        Calculate training readiness score.
        Comprehensive assessment based on HRV, sleep, and previous day's training load.
        """
        # HRV Score (0-40 points): Autonomic nervous system recovery
        hrv_baseline = 45.0  # Individual baseline (updated through learning)
        hrv_score = min(40, max(0, (hrv_rmssd / hrv_baseline) * 30))

        # Sleep Score (0-30 points)
        sleep_component = min(30, sleep_score * 0.3)

        # Recovery Score (0-30 points): Higher previous load = lower score
        recovery_score = max(0, 30 - previous_training_load * 0.3)

        total = hrv_score + sleep_component + recovery_score

        return {
            'total_score': round(total),
            'hrv_component': round(hrv_score),
            'sleep_component': round(sleep_component),
            'recovery_component': round(recovery_score),
            'recommendation': self._get_recommendation(total)
        }

    def _get_recommendation(self, readiness_score):
        if readiness_score >= 80:
            return {
                'intensity': 'high',
                'suggestion': 'High-intensity training recommended (intervals, tempo runs)',
                'hr_zone_target': 'Zone 4-5 (80-100% max HR)',
                'duration_minutes': 45
            }
        elif readiness_score >= 60:
            return {
                'intensity': 'moderate',
                'suggestion': 'Moderate-intensity training recommended (pace runs, strength training)',
                'hr_zone_target': 'Zone 3 (70-80% max HR)',
                'duration_minutes': 60
            }
        elif readiness_score >= 40:
            return {
                'intensity': 'low',
                'suggestion': 'Light training recommended (jogging, yoga, stretching)',
                'hr_zone_target': 'Zone 1-2 (50-70% max HR)',
                'duration_minutes': 30
            }
        else:
            return {
                'intensity': 'rest',
                'suggestion': 'Full rest recommended. Focus on recovery.',
                'hr_zone_target': 'None',
                'duration_minutes': 0
            }

    def analyze_workout(self, hr_data, duration_minutes):
        """Post-workout analysis"""
        hr_reserve = self.max_hr - self.resting_hr

        trimp = 0  # Training Impulse
        for hr in hr_data:
            hr_ratio = (hr - self.resting_hr) / hr_reserve
            trimp += hr_ratio * 0.64 * (2.718 ** (1.92 * hr_ratio))

        trimp *= (duration_minutes / len(hr_data))

        zone_distribution = self._calculate_zone_distribution(hr_data)

        return {
            'trimp_score': round(trimp, 1),
            'training_effect': self._training_effect(trimp),
            'zone_distribution': zone_distribution,
            'peak_hr': max(hr_data),
            'avg_hr': sum(hr_data) / len(hr_data),
            'calories_estimated': round(trimp * 0.8)
        }

    def _calculate_zone_distribution(self, hr_data):
        zones = {f'Zone {i}': 0 for i in range(1, 6)}
        for hr in hr_data:
            pct = hr / self.max_hr * 100
            if pct < 60: zones['Zone 1'] += 1
            elif pct < 70: zones['Zone 2'] += 1
            elif pct < 80: zones['Zone 3'] += 1
            elif pct < 90: zones['Zone 4'] += 1
            else: zones['Zone 5'] += 1

        total = len(hr_data)
        return {k: f"{v/total*100:.1f}%" for k, v in zones.items()}

    def _training_effect(self, trimp):
        if trimp < 50: return "Recovery"
        elif trimp < 100: return "Aerobic base building"
        elif trimp < 200: return "Aerobic capacity improvement"
        elif trimp < 300: return "High-intensity endurance improvement"
        else: return "Overreaching (caution)"

# Usage example
coach = AIFitnessCoach({'age': 35, 'resting_hr': 55})
readiness = coach.calculate_training_readiness(
    hrv_rmssd=52.0, sleep_score=82, previous_training_load=65
)
print(f"Training Readiness: {readiness['total_score']}/100")
print(f"Recommendation: {readiness['recommendation']['suggestion']}")
```

### Use Case 3: Fall Detection and Emergency Call

Apple Watch's fall detection feature uses AI models to identify fall patterns from accelerometer and gyroscope data. It is enabled by default for users aged 65 and older.

```
┌─────────────────────────────────────────────────┐
│          Fall Detection Algorithm Flow             │
│                                                   │
│  Accelerometer + Gyro Data (100Hz)                │
│       │                                           │
│       ▼                                           │
│  ┌───────────────────┐                           │
│  │ Impact Detection   │                           │
│  │ Acceleration > 3G? │                           │
│  └─────────┬─────────┘                           │
│            │ Yes                                  │
│            ▼                                      │
│  ┌───────────────────┐                           │
│  │ Fall Pattern Match │                           │
│  │ - Rapid drop +     │                           │
│  │   impact           │                           │
│  │ - Rotation + stop  │                           │
│  │ - Trip + forward   │                           │
│  │   lean             │                           │
│  └─────────┬─────────┘                           │
│            │ Match                                │
│            ▼                                      │
│  ┌───────────────────┐                           │
│  │ Post-fall Motion   │                           │
│  │ Check              │                           │
│  │ 1-minute immobility│                           │
│  │ detection          │                           │
│  └─────────┬─────────┘                           │
│            │ No movement                          │
│            ▼                                      │
│  ┌───────────────────┐                           │
│  │ Emergency SOS      │                           │
│  │ - Send location    │                           │
│  │ - Notify emergency │                           │
│  │   contacts         │                           │
│  │ - Auto-dial        │                           │
│  │   emergency services│                          │
│  └───────────────────┘                           │
└─────────────────────────────────────────────────┘
```

---

## 5. Troubleshooting

### Issue 1: Inaccurate PPG Heart Rate

**Symptoms:** Heart rate readings during exercise are significantly higher or lower than actual values. Particularly noticeable during running and weight training.

**Root Cause Analysis:**
1. Motion artifacts: Arm movement interferes with the PPG sensor's optical signal
2. Improper band placement: Wearing the watch over bone reduces accuracy due to fewer blood vessels
3. Tattoos or darker skin tones: Changes in light absorption/reflection characteristics

**Solutions:**
- Wear the band 1cm above the wrist bone (ulnar styloid process) with a snug fit
- Use a chest heart rate strap (e.g., Polar H10) during high-intensity exercise
- Tighten the band slightly before exercise
- In cold environments, warm up to ensure peripheral blood flow before measuring

### Issue 2: HealthKit/Health Connect Data Not Syncing

**Symptoms:** Data measured on the watch is not reflected in the smartphone app.

**Root Cause Analysis:**
```
┌─────────────────────────────────────────────────┐
│  Data Sync Checkpoints                            │
│                                                   │
│  1. Permissions → Are HealthKit/Health Connect    │
│     read/write permissions set correctly?         │
│                                                   │
│  2. Bluetooth → Are the watch and smartphone     │
│     paired?                                       │
│                                                   │
│  3. Background Refresh → Is the app's background │
│     refresh enabled?                              │
│                                                   │
│  4. Storage → Is there available storage space   │
│     on the device?                                │
│                                                   │
│  5. OS Version → Are the versions compatible?    │
└─────────────────────────────────────────────────┘
```

**Solution (iOS):**
```swift
// Check HealthKit permissions
let status = healthStore.authorizationStatus(
    for: HKQuantityType.quantityType(forIdentifier: .heartRate)!
)

switch status {
case .notDetermined:
    // Permission has not been requested yet
    requestAuthorization()
case .sharingAuthorized:
    // Write permission granted (read permission cannot be checked by design)
    print("Permission OK")
case .sharingDenied:
    // Permission was denied
    // Direct user to Settings app
    print("Please enable permissions in Settings > Privacy > Health")
}
```

### Issue 3: Rapid Battery Drain

**Symptoms:** Smartwatch battery drains faster than usual (doesn't last a full day).

**Causes and Solutions:**

| Cause | Impact on Power Consumption | Solution |
|------|---------------|------|
| Always-On Display (AOD) | +20-30% | Turn OFF during inactive hours |
| Continuous GPS Use | +40-60% | Enable GPS only during workouts |
| High-Frequency Heart Rate Sampling | +15-25% | Set to 5-minute intervals during normal use |
| Continuous SpO2 Measurement | +10-20% | Enable only during sleep |
| Always-On Wi-Fi | +10-15% | Switch to Bluetooth only |
| Excessive Notifications | +5-10% | Filter unnecessary notifications |

### Issue 4: Sleep Tracking False Positives

**Symptoms:** Naps or simply lying in bed during a movie are detected as "sleep." Bedtime/wake-up times are off by more than 30 minutes.

**Solutions:**
- Manually set a bedtime schedule to narrow the detection window
- Use algorithms that consider heart rate variability data in addition to acceleration (for developers)
- Enable Focus mode (Do Not Disturb) before bed to signal sleep intent to the watch

---

## 6. Performance Optimization

### Optimization 1: Context-Adaptive Sampling

The biggest constraint for wearables is battery life. Rather than running all sensors at full capacity continuously, dynamically adjust sampling rates based on user state (resting/walking/exercising/sleeping).

```
┌─────────────────────────────────────────────────┐
│  Context-Adaptive Sampling Strategy               │
│                                                   │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ Activity  │──▶│ Sampling │──▶│ Battery  │    │
│  │ Recognition│   │ Rate     │   │ Extension│    │
│  │           │   │ Adjust   │   │ Effect   │    │
│  └──────────┘   └──────────┘   └──────────┘    │
│                                                   │
│  State        HR      Accel    GPS    SpO2       │
│  ────────   ─────   ─────  ────   ────          │
│  Resting      5min    OFF    OFF    OFF   → 36h  │
│  Walking      1min    25Hz   OFF    OFF   → 24h  │
│  Exercising   1sec    50Hz   1Hz    OFF   → 8h   │
│  Sleeping     5min    10Hz   OFF    15min → 30h  │
│  Anomaly Det. Cont.   50Hz   OFF    Cont. → 4h  │
│                                                   │
│  State detection via Core Motion CMMotionActivityManager │
│  → Dynamically switch sensor settings on state change   │
└─────────────────────────────────────────────────┘
```

### Optimization 2: On-Device ML Model Quantization

```python
# Improve inference speed and battery efficiency through Core ML model quantization
import coremltools as ct

# Load trained model
model = ct.models.MLModel("HeartRateClassifier.mlpackage")

# INT8 quantization (reduces memory usage by 75%)
quantized_model = ct.models.neural_network.quantization_utils.quantize_weights(
    model,
    nbits=8,  # 32bit → 8bit
    quantization_mode="linear"
)
quantized_model.save("HeartRateClassifier_INT8.mlpackage")

# Performance comparison
# FP32: Inference time 5ms, Model size 2.4MB, Memory 8MB
# INT8: Inference time 2ms, Model size 0.6MB, Memory 2MB
# Even faster when using the Neural Engine
```

### Optimization 3: BLE (Bluetooth Low Energy) Data Transfer Optimization

Data transfer from watch to smartphone occurs via BLE, and each connection/transfer consumes battery. Batch processing and compression of data are important.

```swift
// BLE data transfer optimization pattern
class OptimizedBLETransfer {
    // BAD: Sending data every second
    // → High power consumption from maintaining BLE connection and transferring data

    // GOOD: Buffer data and send in batches every 5 minutes
    var dataBuffer: [HealthSample] = []
    let transferInterval: TimeInterval = 300  // 5 minutes

    func addSample(_ sample: HealthSample) {
        dataBuffer.append(sample)

        // Send when buffer reaches threshold
        if dataBuffer.count >= 300 {  // 5 min × 1Hz = 300 samples
            transferData()
        }
    }

    func transferData() {
        // Delta compression: Send only differences from previous sample
        let compressed = deltaCompress(dataBuffer)

        // Split into chunks matching BLE MTU
        let chunks = compressed.chunked(into: 512)  // 512 bytes/chunk

        for chunk in chunks {
            peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
        }

        dataBuffer.removeAll()
    }

    func deltaCompress(_ samples: [HealthSample]) -> Data {
        // Delta encoding of heart rate values
        // [72, 73, 72, 74, 71] → [72, +1, -1, +2, -3]
        // Differences are small values that can be represented with fewer bits
        var encoded = Data()
        encoded.append(contentsOf: withUnsafeBytes(of: samples[0].value) {
            Array($0)
        })

        for i in 1..<samples.count {
            let diff = Int8(samples[i].value - samples[i-1].value)
            encoded.append(contentsOf: withUnsafeBytes(of: diff) { Array($0) })
        }

        return encoded
    }
}
```

---

## 7. Design Patterns

### Pattern 1: Reactive Health Data Pipeline

Health data is a continuously generated stream, making reactive programming patterns a natural fit. Implementation pattern using Combine (iOS) / Flow (Android).

```swift
import Combine
import HealthKit

class ReactiveHealthPipeline {
    private var cancellables = Set<AnyCancellable>()
    private let healthStore = HKHealthStore()

    /// Reactive stream of heart rate data
    func heartRateStream() -> AnyPublisher<Double, Never> {
        let subject = PassthroughSubject<Double, Never>()

        let heartRateType = HKQuantityType.quantityType(
            forIdentifier: .heartRate)!

        let query = HKAnchoredObjectQuery(
            type: heartRateType,
            predicate: nil,
            anchor: nil,
            limit: HKObjectQueryNoLimit
        ) { _, samples, _, _, _ in
            guard let samples = samples as? [HKQuantitySample] else { return }
            for sample in samples {
                let bpm = sample.quantity.doubleValue(
                    for: HKUnit(from: "count/min"))
                subject.send(bpm)
            }
        }

        query.updateHandler = { _, samples, _, _, _ in
            guard let samples = samples as? [HKQuantitySample] else { return }
            for sample in samples {
                let bpm = sample.quantity.doubleValue(
                    for: HKUnit(from: "count/min"))
                subject.send(bpm)
            }
        }

        healthStore.execute(query)

        return subject.eraseToAnyPublisher()
    }

    /// Build pipeline: Filter → Analyze → Alert
    func setupPipeline() {
        heartRateStream()
            // Noise removal: Exclude physiologically impossible values
            .filter { $0 > 30 && $0 < 250 }
            // Moving average: Average over 5 samples
            .scan([Double]()) { buffer, newValue in
                var buf = buffer
                buf.append(newValue)
                if buf.count > 5 { buf.removeFirst() }
                return buf
            }
            .map { buffer -> Double in
                buffer.reduce(0, +) / Double(buffer.count)
            }
            // Anomaly detection
            .sink { avgBPM in
                if avgBPM > 120 {
                    NotificationCenter.default.post(
                        name: .highHeartRate,
                        object: nil,
                        userInfo: ["bpm": avgBPM]
                    )
                }
            }
            .store(in: &cancellables)
    }
}

extension Notification.Name {
    static let highHeartRate = Notification.Name("highHeartRate")
}
```

### Pattern 2: Local-First + Cloud Sync Architecture

For wearable apps, the fundamental pattern is "operate locally immediately, sync to the cloud asynchronously." This ensures data recording and analysis continue even without a network connection.

```
┌─────────────────────────────────────────────────┐
│  Local-First + Cloud Sync                         │
│                                                   │
│  ┌──────────────────────────────┐               │
│  │ Watch (watchOS/Wear OS)       │               │
│  │                               │               │
│  │  Sensors → Local DB           │               │
│  │              (Core Data/Room) │               │
│  │              │                │               │
│  │              ├── Real-time    │               │
│  │              │   Analysis     │               │
│  │              │   (On-device ML)│              │
│  │              │                │               │
│  │              └── Notifications│               │
│  │                  /Alerts      │               │
│  └──────────────┬───────────────┘               │
│                 │ BLE/Wi-Fi                       │
│  ┌──────────────▼───────────────┐               │
│  │ Smartphone                    │               │
│  │                               │               │
│  │  Local DB ←→ Sync Engine      │               │
│  │              │                │               │
│  │              ├── Advanced     │               │
│  │              │   Analysis     │               │
│  │              │   (LLM-based   │               │
│  │              │   recommendations)│            │
│  │              │                │               │
│  │              └── Dashboard    │               │
│  └──────────────┬───────────────┘               │
│                 │ HTTPS (Wi-Fi only)              │
│  ┌──────────────▼───────────────┐               │
│  │ Cloud                         │               │
│  │                               │               │
│  │  Long-term Data Storage       │               │
│  │  Aggregate Analysis           │               │
│  │  (Population-based comparison)│               │
│  │  AI Model Training & Delivery │               │
│  └──────────────────────────────┘               │
└─────────────────────────────────────────────────┘
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Treating Wearable Data as Equivalent to Medical Diagnosis

```
Bad example:
Self-diagnosing "atrial fibrillation" based solely on Apple Watch irregular rhythm notification
Immediately concluding "lung disease" when SpO2 drops below 95%

Correct approach:
- Use wearable data as a "screening" tool
- Consult a healthcare provider if anomalies persist
- Apple Watch ECG only "suggests the possibility" of atrial fibrillation
- Understand the scope of FDA/medical device certification
```

### Anti-Pattern 2: Running Sensors at Full Capacity Without Considering Battery

```
Bad example:
Acquiring all sensors (PPG + accelerometer + GPS + SpO2) at 1-second intervals continuously
→ Battery depletes in a few hours

Correct approach:
- Normal use: Heart rate every 5 minutes, accelerometer batch processing
- During exercise: Heart rate every second, continuous GPS
- During sleep: Low-frequency accelerometer, heart rate every 5 minutes
- Context-adaptive sampling (based on activity recognition)
```

### Anti-Pattern 3: Neglecting Privacy in Health Data Handling

```
Bad example:
- Sending health data to the cloud without encryption
- Sharing data with third parties without user consent
- Storing health data and personally identifiable information in the same database

Correct approach:
- Comply with HIPAA/GDPR/Personal Information Protection Act
- Encrypt health data at rest and in transit (AES-256, TLS 1.3)
- Always implement data anonymization/pseudonymization
- Follow HealthKit / Health Connect permission models
- Allow users to delete their data at any time
- Comply with Apple's HealthKit Review Guidelines
```

### Anti-Pattern 4: Over-Reliance on a Single Sensor

```
Bad example:
Determining exercise intensity based solely on PPG heart rate
→ May be significantly off due to motion artifacts

Correct approach:
- Sensor fusion: Combine PPG + accelerometer + gyroscope
- Detect motion artifacts with accelerometer and correct PPG signal
- Assign confidence scores and alert when data has low reliability
- Cross-check sensor consistency (if heart rate spikes but
  accelerometer shows no change, it's likely an artifact)
```

---

## 9. Edge Case Analysis

### Edge Case 1: PPG Accuracy Degradation in Cold Environments

In cold environments (below 0°C), peripheral blood vessels constrict and blood flow to the wrist decreases significantly. This reduces the signal-to-noise ratio (SNR) of the PPG sensor, causing substantial degradation in heart rate measurement accuracy.

```
Relationship between ambient temperature and PPG accuracy:

Temperature   Vascular State       PPG Accuracy   Countermeasure
──────────   ──────────────       ────────────   ──────────────
25°C+        Normal dilation      ±2 BPM         Normal operation
15-25°C      Slight constriction  ±3-5 BPM       Normal operation
5-15°C       Constricted          ±5-10 BPM      Check band position
Below 0°C    Strong constriction  ±10-20 BPM     Chest strap recommended
Below -10°C  Extreme constriction Unmeasurable    Wear under gloves

Developer countermeasures:
1. Calculate a Signal Quality Indicator (SQI) and notify the
   user when quality is low
2. Cross-check with accelerometer data to remove artifacts
3. Detect cold environments via temperature sensor and
   automatically increase measurement intervals
   (battery saving + false data prevention)
```

### Edge Case 2: Sensor Accuracy on Tattooed Wrists

Tattoo pigments (especially dark-colored ink) absorb PPG sensor light, significantly reducing signal quality. Apple officially acknowledges that "some tattoos may affect sensor performance."

**Impact levels:**
| Tattoo Color | Impact Level | Countermeasure |
|------------|----------|------|
| Black/Dark Navy | High (may be unmeasurable) | Wear on the opposite wrist |
| Red/Green | Medium | Accept reduced reliability |
| Light colors/Thin lines | Low to None | Normal use is fine |
| White/UV | Virtually None | Normal use is fine |

---

## 10. Developer Checklist

### Quality Checklist for Wearable App Development

```
[ ] Are HealthKit / Health Connect permission requests made at the appropriate time?
[ ] Is background sensor access context-adaptive?
[ ] Has battery consumption been tested for at least 48 hours?
[ ] Are confidence scores assigned to sensor data?
[ ] Is motion artifact removal processing implemented?
[ ] Can data recording continue offline?
[ ] Is health data encryption (at rest and in transit) implemented?
[ ] Have HIPAA/GDPR/Personal Information Protection Act requirements been reviewed?
[ ] Has it been determined whether the app falls under medical device regulation (FDA 510(k)/CE/PMDA)?
[ ] Have sensor sampling rates been optimized for sleep/exercise/resting states?
[ ] Is BLE data transfer batch processing implemented?
[ ] Has the app's medical claims been verified to be within regulatory scope?
[ ] Is the anomaly detection alert frequency appropriate (too many alerts get ignored)?
[ ] Can users delete and export their data?
[ ] Has the data update frequency for complications/Tiles been optimized?
```

---

## FAQ

### Q1: How accurate are smartwatch heart rate monitors?

**A:** At rest, accuracy is near medical-grade (±2 BPM), but during high-intensity exercise, errors of ±5-10 BPM can occur. This is caused by changes in sensor contact due to arm movement (motion artifacts). For accurate measurement, it is important to wear the band snugly, positioned 1cm above the wrist bone.

### Q2: Can sleep tracking be trusted?

**A:** Total sleep time estimation is relatively accurate (within ±15 minutes compared to PSG), but sleep stage classification (deep sleep/REM/light sleep) has a 70-80% agreement rate. While this has limitations compared to medical-grade EEG (PSG), it is sufficiently useful for identifying long-term trends.

### Q3: What is the most important consideration in wearable app development?

**A:** Battery efficiency. Since wearables run on small batteries, sensor acquisition frequency, background processing, and communication volume must be minimized. Recommended patterns include Core Motion batch processing, HealthKit background delivery, and low-frequency data sync via BLE.

### Q4: Can wearable health data be used for medical purposes?

**A:** It is possible, but with several conditions. First, data accuracy and validation must be confirmed through clinical research. The Apple Watch ECG feature has received FDA De Novo authorization and can be referenced by physicians for atrial fibrillation screening. Second, medical device certification may be required. Regulations differ significantly depending on whether the product is marketed as a wellness app or a medical device. Apple's ResearchKit / CareKit frameworks are designed to standardize data collection in clinical research.

### Q5: How can data from multiple wearable devices be integrated?

**A:** HealthKit (iOS) and Health Connect (Android) are the standard platforms for data integration. Data from multiple wearables (Apple Watch + Oura Ring + Garmin, etc.) is stored in these platforms using a unified schema. Developers can access integrated data through these APIs. However, when the same type of data (e.g., heart rate) comes from multiple sources, logic to determine source priority is needed. Generally, the "closest source to the device" (direct measurement > estimated values) takes precedence.

---

## Summary

| Item | Key Points |
|------|---------|
| Core Sensors | PPG (heart rate), accelerometer, ECG, SpO2, temperature |
| Health Monitoring | Analyze heart rate/HRV/sleep/SpO2 with AI |
| AI Applications | Arrhythmia detection, stress estimation, workout optimization |
| Development APIs | HealthKit (Apple), Health Connect (Android) |
| Battery | Context-adaptive sampling is essential |
| Key Consideration | A screening tool, not a replacement for medical diagnosis |
| Privacy | HIPAA/GDPR compliance, encryption, and anonymization are essential |
| Sensor Fusion | Combining multiple sensors improves accuracy |

---

## Recommended Next Reads

- [AI PC — NPU-Equipped PCs and Local LLMs](../01-computing/00-ai-pcs.md)
- [Edge AI — Jetson, Coral, Inference Optimization](../01-computing/02-edge-ai.md)
- [Smart Home — Matter, Thread, AI Automation](../02-emerging/02-smart-home.md)

---

## References

1. **Apple** — "Using Apple Watch for Health Research," apple.com/healthcare, 2024
2. **Perez, M.V. et al.** — "Large-Scale Assessment of a Smartwatch to Identify Atrial Fibrillation," NEJM, 2019
3. **Samsung** — "Galaxy Watch BIA Body Composition Analysis," samsung.com, 2024
4. **Google** — "Health Connect API Documentation," developer.android.com, 2024
5. **Bent, B. et al.** — "Investigating sources of inaccuracy in wearable optical heart rate sensors," npj Digital Medicine, 2020
6. **Castaneda, D. et al.** — "A review on wearable photoplethysmography sensors and their potential future applications in health care," IJBS, 2018
