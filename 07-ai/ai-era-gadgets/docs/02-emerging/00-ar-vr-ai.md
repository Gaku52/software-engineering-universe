# AR/VR x AI Guide

> A comprehensive guide to Vision Pro, Quest, and AI spatial computing technologies and their future

## What You Will Learn in This Chapter

1. **AR/VR Fundamentals** — How displays, tracking, and rendering work
2. **Major Platforms** — Comparison of Apple Vision Pro, Meta Quest, and other XR devices
3. **AI x Spatial Computing** — Innovations AI brings to AR/VR and practical development approaches


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. Basic Concepts of AR/VR/MR

### Reality-Virtuality Continuum

```
Real World                                          Virtual World
   |                                                  |
   v                                                  v
+------+--------+----------------+-----------+--------+
| Real |   AR   |      MR       |    VR     | Fully  |
|      |Augmented| Mixed Reality | Virtual   |Virtual |
|      |Reality |               | Reality   |        |
+------+--------+----------------+-----------+--------+
   |       |            |              |          |
   |   Mobile AR   Vision Pro     Quest 3     VRChat
   |   Pokemon GO  HoloLens 2   (Passthrough) Metaverse
   |   Google Lens                PSVR 2
   |
   +--- XR (Extended Reality): Umbrella term for AR + MR + VR
```

### Basic Components of an XR Headset

```
+-----------------------------------------------------------+
|              XR Headset Internal Structure                  |
+-----------------------------------------------------------+
|                                                           |
|  +------------------+  +------------------+               |
|  | Display          |  | Lens             |               |
|  | Micro-OLED       |  | Pancake Lens     |               |
|  | 2K-4K per eye    |  | Thin & Lightweight|              |
|  +------------------+  +------------------+               |
|                                                           |
|  +------------------+  +------------------+               |
|  | Chipset          |  | Sensor Array     |               |
|  | SoC (GPU+CPU+NPU)|  | Camera(Passthrough)|             |
|  | Apple M2/R1      |  | LiDAR/ToF       |               |
|  | Snapdragon XR2   |  | IMU (Accel+Gyro)|               |
|  +------------------+  +------------------+               |
|                                                           |
|  +------------------+  +------------------+               |
|  | Tracking         |  | Input Devices    |               |
|  | Inside-Out 6DoF  |  | Hand Tracking    |               |
|  | Eye Tracking     |  | Controller       |               |
|  | SLAM             |  | Voice Input      |               |
|  +------------------+  +------------------+               |
+-----------------------------------------------------------+
```

### Detailed Layer Structure of the XR Technology Stack

```
+-----------------------------------------------------------+
|              XR Technology Stack                            |
+-----------------------------------------------------------+
|                                                           |
|  L6: Application Layer                                    |
|  +-- Games, Collaboration, Education, Healthcare          |
|  +-- 3D Viewers, Spatial Design                           |
|                                                           |
|  L5: Framework Layer                                      |
|  +-- ARKit / ARCore / OpenXR                               |
|  +-- RealityKit / SceneKit / WebXR                         |
|                                                           |
|  L4: Rendering Engine Layer                               |
|  +-- Unity / Unreal Engine / RealityKit                    |
|  +-- Vulkan / Metal / WebGL                                |
|                                                           |
|  L3: AI/ML Processing Layer                               |
|  +-- Core ML / TFLite / ONNX Runtime                       |
|  +-- Spatial Recognition, Hand Tracking, Eye Tracking      |
|                                                           |
|  L2: OS/Runtime Layer                                     |
|  +-- visionOS / Android (Horizon OS) / SteamVR             |
|  +-- Device Drivers, Sensor Fusion                        |
|                                                           |
|  L1: Hardware Layer                                       |
|  +-- SoC (M2, XR2), Displays, Lenses                      |
|  +-- Cameras, LiDAR, IMU, Battery                         |
+-----------------------------------------------------------+
```

---

## 2. Major XR Platform Comparison

### Device Comparison Table

| Item | Apple Vision Pro | Meta Quest 3 | Meta Quest Pro | PSVR 2 |
|------|-----------------|--------------|----------------|--------|
| Release Year | 2024 | 2023 | 2022 | 2023 |
| Price | $3,499 | $499 | $999 | $549 |
| Chip | M2 + R1 | Snapdragon XR2 Gen 2 | Snapdragon XR2+ | Custom Chip (PS5 Connected) |
| Resolution (per eye) | 3,660x3,200 | 2,064x2,208 | 1,800x1,920 | 2,000x2,040 |
| Refresh Rate | 90-100Hz | 90-120Hz | 90Hz | 90-120Hz |
| Tracking | 6DoF + Eye + Hand | 6DoF + Hand | 6DoF + Eye + Hand | 6DoF + Eye |
| Passthrough | High-Quality Color | Color | Color | None (Pure VR) |
| OS | visionOS | Android (Meta Horizon) | Android (Meta Horizon) | PS5 Exclusive |
| Weight | 600-650g | 515g | 722g | 560g |
| Primary Use | Spatial Computing | Gaming/MR | Business | Gaming |

### Next-Generation Device Trends (2025-2026)

| Device | Manufacturer | Features | Expected Price Range |
|---------|-------------|----------|---------------------|
| Vision Pro 2 | Apple | M4 chip, lighter, lower price | $2,499-2,999 |
| Quest 4 | Meta | Snapdragon XR2+ Gen 3, 8K display | $499-699 |
| Project Moohan | Samsung | Android XR, Qualcomm XR2+ Gen 2 | $1,000-1,500 |
| HoloLens 3 | Microsoft | Military/industrial focused, wide FoV | $3,000+ |
| MagicLeap 3 | Magic Leap | Industrial AR, lightweight glasses form | $2,500+ |

### Display Technology Evolution

```
+-----------------------------------------------------------+
|  XR Display Technologies                                   |
+-----------------------------------------------------------+
|                                                           |
|  LCD         |████████████|  Low cost, Quest 2             |
|  Resolution: Mid  Contrast: Low   Response: Mid            |
|                                                           |
|  OLED        |██████████████████|  High contrast, PSVR 2  |
|  Resolution: High  Contrast: High  Response: High          |
|                                                           |
|  Micro-OLED  |████████████████████████|  Vision Pro        |
|  Resolution: Highest  Contrast: Highest  Response: Highest |
|                                                           |
|  Micro-LED   |██████████████████████████████|  Next-Gen    |
|  Resolution: Highest  Contrast: Highest  Brightness: Highest  Power: Low |
+-----------------------------------------------------------+
```

### Lens Technology Comparison

| Lens Type | Thickness | Weight | FoV | Distortion | Examples |
|-----------|----------|--------|-----|-----------|----------|
| Fresnel Lens | Thick | Heavy | 100-110 deg | Medium | Quest 2, Valve Index |
| Pancake Lens | Thin | Light | 90-110 deg | Low | Quest 3, Vision Pro |
| Varifocal | Medium | Medium | 90-100 deg | Very Low | Half Dome (Prototype) |
| Holographic | Ultra-Thin | Ultra-Light | 40-60 deg | Low | HoloLens, MagicLeap |
| Metasurface Lens | Ultra-Thin | Ultra-Light | Research Stage | Very Low | Future AR Glasses |

---

## 3. AI x Spatial Computing

### How AI is Transforming XR Experiences

```
+-----------------------------------------------------------+
|  AI x XR Convergence Areas                                 |
+-----------------------------------------------------------+
|                                                           |
|  Visual AI                                                |
|  +-- Spatial Recognition: 3D room mapping (SLAM + NeRF)  |
|  +-- Object Recognition: Real-time recognition of         |
|  |   real-world objects                                   |
|  +-- Segmentation: Separating foreground and background   |
|  +-- Occlusion: Accurately handling depth ordering of     |
|      virtual objects                                      |
|                                                           |
|  Natural Language AI                                      |
|  +-- Voice Commands: Voice control for spatial UI         |
|  +-- Real-time Translation: AR subtitles                  |
|  +-- Spatial Conversational AI: Dialogue with virtual     |
|      avatars                                              |
|                                                           |
|  Generative AI                                            |
|  +-- 3D Asset Generation: 3D models from text             |
|  +-- Environment Generation: AI-driven VR space creation  |
|  +-- Avatar Generation: Realistic avatar from a single    |
|      photo                                                |
|                                                           |
|  Predictive AI                                            |
|  +-- Foveated Rendering: Gaze prediction for render       |
|      optimization                                         |
|  +-- Motion Prediction: Motion interpolation to eliminate |
|      perceived latency                                    |
|  +-- Adaptive Quality: Dynamic quality adjustment based   |
|      on load prediction                                   |
+-----------------------------------------------------------+
```

### How SLAM (Simultaneous Localization and Mapping) Works

```
+-----------------------------------------------------------+
|  SLAM Pipeline Details                                     |
+-----------------------------------------------------------+
|                                                           |
|  Input Sensors                                            |
|  +-- Mono Camera / Stereo Camera                          |
|  +-- IMU (Accelerometer + Gyroscope)                      |
|  +-- LiDAR / ToF Sensor                                   |
|  +-- Depth Sensor                                         |
|       |                                                   |
|       v                                                   |
|  +----------------------------------------------+         |
|  |  Front-End                                    |         |
|  |  +-- Feature Detection (ORB, SIFT, SuperPoint)|        |
|  |  +-- Feature Matching                         |         |
|  |  +-- Visual Odometry                          |         |
|  |  +-- IMU Pre-Integration                      |         |
|  +----------------------------------------------+         |
|       |                                                   |
|       v                                                   |
|  +----------------------------------------------+         |
|  |  Back-End                                     |         |
|  |  +-- Bundle Adjustment                        |         |
|  |  +-- Pose Graph Optimization                  |         |
|  |  +-- Loop Closure Detection                   |         |
|  |  +-- Keyframe Management                      |         |
|  +----------------------------------------------+         |
|       |                                                   |
|       v                                                   |
|  Output: 3D Map + Camera Pose Estimation                  |
+-----------------------------------------------------------+
```

### Code Example 1: Plane Detection and 3D Placement with ARKit

```swift
import ARKit
import RealityKit

class ViewController: UIViewController, ARSessionDelegate {
    @IBOutlet var arView: ARView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // AR session configuration
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        config.sceneReconstruction = .meshWithClassification
        config.environmentTexturing = .automatic

        arView.session.delegate = self
        arView.session.run(config)

        // Place 3D object on tap
        let tapGesture = UITapGestureRecognizer(
            target: self, action: #selector(handleTap)
        )
        arView.addGestureRecognizer(tapGesture)
    }

    @objc func handleTap(_ sender: UITapGestureRecognizer) {
        let location = sender.location(in: arView)

        // Get intersection point with plane via raycast
        if let result = arView.raycast(
            from: location,
            allowing: .estimatedPlane,
            alignment: .horizontal
        ).first {
            // Place a 3D object
            let anchor = AnchorEntity(world: result.worldTransform)
            let box = ModelEntity(
                mesh: .generateBox(size: 0.1),
                materials: [SimpleMaterial(color: .blue, isMetallic: true)]
            )
            anchor.addChild(box)
            arView.scene.addAnchor(anchor)
        }
    }
}
```

### Code Example 2: Spatial Computing with visionOS

```swift
import SwiftUI
import RealityKit

@main
struct MyVisionApp: App {
    var body: some Scene {
        // Window (2D UI)
        WindowGroup {
            ContentView()
        }

        // Volume (3D Content)
        WindowGroup(id: "3d-viewer") {
            VolumetricView()
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 0.5, height: 0.5, depth: 0.5, in: .meters)

        // Immersive Space (Fully Immersive Experience)
        ImmersiveSpace(id: "immersive") {
            ImmersiveView()
        }
    }
}

struct VolumetricView: View {
    var body: some View {
        RealityView { content in
            // Load and display a 3D model
            if let model = try? await ModelEntity(named: "Globe") {
                model.scale = [0.3, 0.3, 0.3]
                content.add(model)
            }
        }
        .gesture(
            // Rotate with hand gestures
            RotateGesture3D()
                .targetedToAnyEntity()
                .onChanged { value in
                    value.entity.transform.rotation = value.rotation
                }
        )
    }
}
```

### Code Example 3: Spatial Understanding with AI

```python
# Meta Quest Scene Understanding API (conceptual code)
# Understanding room structure in an MR app

class SpatialAIProcessor:
    def __init__(self):
        self.scene_model = load_model("room_segmentation_v2")
        self.object_detector = load_model("3d_object_detection")

    def process_scene(self, depth_map, rgb_image, imu_data):
        """Spatial recognition pipeline"""
        # 1. Generate 3D point cloud from depth map
        point_cloud = depth_to_pointcloud(depth_map, camera_intrinsics)

        # 2. Semantic segmentation (walls, floor, ceiling, furniture)
        segmentation = self.scene_model.predict(point_cloud, rgb_image)
        # -> {'wall': [...], 'floor': [...], 'ceiling': [...], 'furniture': [...]}

        # 3. 3D object detection and classification
        objects = self.object_detector.detect(point_cloud, rgb_image)
        # -> [{'class': 'chair', 'bbox_3d': ..., 'confidence': 0.95}, ...]

        # 4. Build spatial mesh
        scene_mesh = reconstruct_mesh(point_cloud, segmentation)

        return {
            'mesh': scene_mesh,
            'objects': objects,
            'planes': extract_planes(segmentation),
        }
```

### Code Example 4: Hand Tracking and Gesture Recognition on visionOS

```swift
import SwiftUI
import RealityKit
import ARKit

struct HandTrackingView: View {
    @State private var handAnchorEntities: [UUID: AnchorEntity] = [:]

    var body: some View {
        RealityView { content in
            // Enable hand tracking
            let session = ARKitSession()
            let handTracking = HandTrackingProvider()

            Task {
                try await session.run([handTracking])

                for await update in handTracking.anchorUpdates {
                    let anchor = update.anchor

                    switch update.event {
                    case .added:
                        // Visualize hand joint positions
                        let entity = createHandVisualization(from: anchor)
                        content.add(entity)
                        handAnchorEntities[anchor.id] = entity

                    case .updated:
                        updateHandVisualization(
                            entity: handAnchorEntities[anchor.id],
                            from: anchor
                        )

                        // Detect pinch gesture
                        if let thumbTip = anchor.handSkeleton?.joint(.thumbTip),
                           let indexTip = anchor.handSkeleton?.joint(.indexFingerTip) {
                            let distance = simd_distance(
                                thumbTip.anchorFromJointTransform.columns.3,
                                indexTip.anchorFromJointTransform.columns.3
                            )
                            if distance < 0.02 {
                                handlePinchGesture(at: thumbTip.anchorFromJointTransform)
                            }
                        }

                    case .removed:
                        handAnchorEntities[anchor.id]?.removeFromParent()
                    }
                }
            }
        }
    }

    func createHandVisualization(from anchor: HandAnchor) -> AnchorEntity {
        let entity = AnchorEntity()
        // Place a sphere at each joint
        if let skeleton = anchor.handSkeleton {
            for joint in HandSkeleton.JointName.allCases {
                let sphere = ModelEntity(
                    mesh: .generateSphere(radius: 0.005),
                    materials: [SimpleMaterial(color: .cyan, isMetallic: false)]
                )
                entity.addChild(sphere)
            }
        }
        return entity
    }

    func updateHandVisualization(entity: AnchorEntity?, from anchor: HandAnchor) {
        // Update position of each joint
        guard let entity = entity, let skeleton = anchor.handSkeleton else { return }
        for (index, joint) in HandSkeleton.JointName.allCases.enumerated() {
            if index < entity.children.count {
                let transform = skeleton.joint(joint).anchorFromJointTransform
                entity.children[index].transform = Transform(matrix: transform)
            }
        }
    }

    func handlePinchGesture(at transform: simd_float4x4) {
        print("Pinch gesture detected: \(transform.columns.3)")
    }
}
```

### Code Example 5: Persisting and Sharing Spatial Anchors

```swift
import ARKit
import RealityKit
import MultipeerConnectivity

class SpatialAnchorManager {
    private var worldMap: ARWorldMap?
    private var savedAnchors: [ARAnchor] = []
    private let session: ARSession

    init(session: ARSession) {
        self.session = session
    }

    /// Save the current world map (persist spatial anchors)
    func saveWorldMap() async throws -> Data {
        let worldMap = try await session.currentWorldMap
        self.worldMap = worldMap

        // Serialize the world map
        let data = try NSKeyedArchiver.archivedData(
            withRootObject: worldMap,
            requiringSecureCoding: true
        )

        // Save to file
        let url = getDocumentsDirectory().appendingPathComponent("worldmap.arexperience")
        try data.write(to: url)

        print("World map saved: \(worldMap.anchors.count) anchors")
        return data
    }

    /// Restore a saved world map
    func loadWorldMap(from data: Data) throws {
        guard let worldMap = try NSKeyedUnarchiver.unarchivedObject(
            ofClass: ARWorldMap.self, from: data
        ) else {
            throw ARError(.invalidWorldMap)
        }

        let config = ARWorldTrackingConfiguration()
        config.initialWorldMap = worldMap
        config.planeDetection = [.horizontal, .vertical]
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    /// Add a spatial anchor at a specific position
    func addAnchor(at transform: simd_float4x4, name: String) -> ARAnchor {
        let anchor = ARAnchor(name: name, transform: transform)
        session.add(anchor: anchor)
        savedAnchors.append(anchor)
        return anchor
    }

    /// Send anchor data for multi-user sharing
    func shareAnchors(via session: MCSession) throws {
        guard let worldMap = self.worldMap else {
            throw NSError(domain: "AR", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "World map has not been saved yet"
            ])
        }

        let data = try NSKeyedArchiver.archivedData(
            withRootObject: worldMap,
            requiringSecureCoding: true
        )

        try session.send(data, toPeers: session.connectedPeers, with: .reliable)
        print("Anchor data sent to \(session.connectedPeers.count) devices")
    }

    private func getDocumentsDirectory() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}
```

### Code Example 6: AR Application with WebXR

```javascript
// Browser-based AR app using the WebXR API
class WebXRApp {
    constructor() {
        this.session = null;
        this.gl = null;
        this.referenceSpace = null;
        this.hitTestSource = null;
    }

    async checkSupport() {
        if (!navigator.xr) {
            throw new Error('WebXR API is not supported');
        }
        const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isSupported) {
            throw new Error('AR sessions are not supported');
        }
        return true;
    }

    async startAR() {
        // Start AR session
        this.session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test', 'dom-overlay', 'anchors'],
            optionalFeatures: ['plane-detection', 'depth-sensing'],
            domOverlay: { root: document.getElementById('overlay') }
        });

        // Set up WebGL context
        const canvas = document.createElement('canvas');
        this.gl = canvas.getContext('webgl2', { xrCompatible: true });

        await this.gl.makeXRCompatible();

        // Set up rendering layer
        const layer = new XRWebGLLayer(this.session, this.gl);
        await this.session.updateRenderState({ baseLayer: layer });

        // Get reference space
        this.referenceSpace = await this.session.requestReferenceSpace('local');

        // Start hit testing
        const viewerSpace = await this.session.requestReferenceSpace('viewer');
        this.hitTestSource = await this.session.requestHitTestSource({
            space: viewerSpace,
        });

        // Start frame loop
        this.session.requestAnimationFrame(this.onFrame.bind(this));
    }

    onFrame(time, frame) {
        const session = frame.session;
        session.requestAnimationFrame(this.onFrame.bind(this));

        // Get hit test results
        if (this.hitTestSource) {
            const results = frame.getHitTestResults(this.hitTestSource);
            if (results.length > 0) {
                const hit = results[0];
                const pose = hit.getPose(this.referenceSpace);
                this.updateReticle(pose.transform);
            }
        }

        // Rendering
        const glLayer = session.renderState.baseLayer;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, glLayer.framebuffer);

        const pose = frame.getViewerPose(this.referenceSpace);
        if (pose) {
            for (const view of pose.views) {
                const viewport = glLayer.getViewport(view);
                this.gl.viewport(
                    viewport.x, viewport.y,
                    viewport.width, viewport.height
                );
                this.renderScene(view.projectionMatrix, view.transform);
            }
        }
    }

    async placeObject(frame) {
        const results = frame.getHitTestResults(this.hitTestSource);
        if (results.length > 0) {
            const pose = results[0].getPose(this.referenceSpace);
            // Create a spatial anchor and place object
            const anchor = await frame.createAnchor(
                pose.transform, this.referenceSpace
            );
            this.addVirtualObject(anchor);
            console.log('3D object placed');
        }
    }

    updateReticle(transform) {
        // Display reticle at hit point
    }

    renderScene(projectionMatrix, transform) {
        // Render the 3D scene
    }

    addVirtualObject(anchor) {
        // Add a virtual object at the anchor position
    }
}

// Usage example
const app = new WebXRApp();
document.getElementById('start-ar').addEventListener('click', async () => {
    try {
        await app.checkSupport();
        await app.startAR();
    } catch (e) {
        console.error('AR launch error:', e.message);
    }
});
```

---

## 4. Foveated Rendering

### Render Optimization via AI Gaze Prediction

```
+-----------------------------------------------------------+
|  Foveated Rendering                                        |
+-----------------------------------------------------------+
|                                                           |
|  Traditional: Render entire screen at high resolution      |
|  +--------------------------------------------+          |
|  |############################################|          |
|  |############################################|          |
|  |############################################|          |
|  |############################################|          |
|  +--------------------------------------------+          |
|  -> GPU load: 100%                                        |
|                                                           |
|  Foveated: High resolution only at gaze center            |
|  +--------------------------------------------+          |
|  |.........:::::::::::::::::::::...............|          |
|  |......::::::::#########::::::::..............|          |
|  |....::::::::##(Gaze Center)##::::::::........|          |
|  |......::::::::#########::::::::..............|          |
|  |.........:::::::::::::::::::::...............|          |
|  +--------------------------------------------+          |
|  # = High res  : = Mid res  . = Low res                   |
|  -> GPU load: 30-50% (AI gaze prediction for latency      |
|     compensation)                                         |
+-----------------------------------------------------------+
```

### Foveated Rendering Implementation Pattern

```python
class FoveatedRenderer:
    """Foveated rendering with AI gaze prediction"""

    def __init__(self, display_resolution=(3660, 3200)):
        self.display_res = display_resolution
        self.eye_tracker = EyeTracker()
        self.gaze_predictor = GazePredictionModel()

        # Resolution zone configuration
        self.zones = {
            'foveal': {'radius': 0.1, 'scale': 1.0},    # Fovea: full resolution
            'para_foveal': {'radius': 0.3, 'scale': 0.5}, # Parafovea: 50%
            'peripheral': {'radius': 1.0, 'scale': 0.25}, # Peripheral: 25%
        }

    def get_render_targets(self, current_gaze, dt):
        """
        Generate render targets based on gaze position

        Uses AI gaze prediction to estimate gaze position 20ms ahead,
        compensating for rendering latency
        """
        # AI gaze prediction (predict 20ms ahead)
        predicted_gaze = self.gaze_predictor.predict(
            current_gaze=current_gaze,
            prediction_horizon_ms=20,
        )

        targets = []
        for zone_name, zone_config in self.zones.items():
            target = RenderTarget(
                center=predicted_gaze,
                radius=zone_config['radius'],
                resolution_scale=zone_config['scale'],
                resolution=(
                    int(self.display_res[0] * zone_config['scale']),
                    int(self.display_res[1] * zone_config['scale']),
                ),
            )
            targets.append(target)

        return targets

    def composite_frame(self, rendered_zones):
        """Composite rendering results from each zone"""
        final_frame = create_framebuffer(self.display_res)

        for zone in reversed(rendered_zones):
            # Composite from lowest resolution first (overwrite method)
            upscaled = bilinear_upscale(zone.image, self.display_res)
            blend_to_framebuffer(final_frame, upscaled, zone.mask)

        return final_frame
```

### Asynchronous Spacewarp (ASW) / Reprojection

```
+-----------------------------------------------------------+
|  Frame Interpolation Technology                            |
+-----------------------------------------------------------+
|                                                           |
|  Problem: GPU cannot maintain frame rate (90fps)           |
|           -> Causes VR sickness and flickering             |
|                                                           |
|  Solution: ASW / Timewarp                                  |
|                                                           |
|  Frame N      Frame N+1       Frame N+2                    |
|  [Real Render] [AI Interpolated] [Real Render]             |
|      |             |              |                        |
|      v             v              v                        |
|  GPU: 45fps -> Display: 90fps                              |
|                                                           |
|  How AI interpolation works:                               |
|  1. Obtain depth buffer from previous frame                |
|  2. Predict next frame viewpoint from head movement (IMU)  |
|  3. Warp image using depth-based reprojection              |
|  4. Fill holes (disocclusion) with AI                      |
|                                                           |
|  Result: Appears as 90fps to the user                      |
+-----------------------------------------------------------+
```

---

## 5. XR Development Platform Comparison

| Item | Unity | Unreal Engine | visionOS (RealityKit) | WebXR |
|------|-------|--------------|----------------------|-------|
| Supported Devices | Quest, Vision Pro, PSVR, etc. | Quest, PSVR, etc. | Vision Pro only | All browsers |
| Language | C# | C++/Blueprint | Swift | JavaScript |
| Learning Curve | Medium | High | Medium | Low |
| Graphics Quality | High | Very High | High | Medium |
| AI Integration | Barracuda, ONNX | NNE Plugin | Core ML, Create ML | TF.js, ONNX.js |
| 3D Physics | PhysX | Chaos Physics | RealityKit Physics | Ammo.js |
| License | Free to Paid | Royalty-based | Free | Free |

### OpenXR Standard and Its Significance

```
+-----------------------------------------------------------+
|  OpenXR Architecture                                       |
+-----------------------------------------------------------+
|                                                           |
|  Applications                                             |
|  +-- Unity XR Plugin                                       |
|  +-- Unreal OpenXR Plugin                                  |
|  +-- Custom Engines                                        |
|       |                                                   |
|       v                                                   |
|  +----------------------------------------------+         |
|  |  OpenXR API (Unified Interface)               |         |
|  |  - Input: Actions, Poses                      |         |
|  |  - Rendering: Swapchain                       |         |
|  |  - Spatial: Reference Spaces, Anchors         |         |
|  |  - Extensions: Hand Tracking, etc.            |         |
|  +----------------------------------------------+         |
|       |                                                   |
|       v                                                   |
|  +--------------+  +--------------+  +--------------+     |
|  | SteamVR      |  | Oculus       |  | WMR          |     |
|  | Runtime      |  | Runtime      |  | Runtime      |     |
|  +--------------+  +--------------+  +--------------+     |
|       |                 |                  |              |
|       v                 v                  v              |
|  [Valve Index]    [Quest 3]         [HP Reverb G2]       |
|                                                           |
|  Benefit: Support multiple devices with a single codebase |
+-----------------------------------------------------------+
```

---

## 6. XR Use Cases and Industrial Applications

### XR Applications by Industry

| Industry | Use Case | Technology Used | Impact |
|----------|---------|----------------|--------|
| Healthcare | Surgical Simulation | VR + Haptic Feedback | 15% improvement in surgery success rate |
| Healthcare | Anatomy Education | AR + 3D Models | 40% improvement in learning efficiency |
| Manufacturing | Remote Maintenance Support | AR + AI Assistant | 30% reduction in downtime |
| Manufacturing | Assembly Work Instructions | AR + Step-by-Step | 60% reduction in error rate |
| Architecture | Design Preview | MR + BIM Models | 50% reduction in design changes |
| Education | Virtual Field Trips | VR + 360-degree Video | 3x improvement in learning retention |
| Retail | Virtual Try-On | AR + 3D Body Scan | 25% reduction in returns |
| Real Estate | VR Property Tours | VR + 3D Scanning | 20% improvement in conversion rate |

### Code Example 7: Conceptual Design of an Industrial AR Maintenance Support System

```python
class IndustrialARSupport:
    """Industrial AR maintenance support system"""

    def __init__(self):
        self.equipment_db = EquipmentDatabase()
        self.ai_diagnostic = DiagnosticAI()
        self.ar_overlay = AROverlayEngine()
        self.remote_expert = RemoteExpertConnection()

    async def identify_equipment(self, camera_frame):
        """Identify equipment from camera image"""
        # Identify equipment using AI object recognition
        detection = await self.ai_diagnostic.identify(camera_frame)
        equipment = self.equipment_db.get_info(detection.equipment_id)

        return {
            'id': equipment.id,
            'name': equipment.name,
            'model': equipment.model,
            'last_maintenance': equipment.last_maintenance,
            'manual_url': equipment.manual_url,
        }

    async def diagnose_issue(self, equipment_id, sensor_data, visual_data):
        """AI-powered fault diagnosis"""
        diagnosis = await self.ai_diagnostic.analyze(
            equipment_id=equipment_id,
            sensor_readings=sensor_data,
            visual_inspection=visual_data,
        )

        return {
            'issue': diagnosis.description,
            'severity': diagnosis.severity,  # 'low', 'medium', 'high', 'critical'
            'confidence': diagnosis.confidence,
            'recommended_actions': diagnosis.actions,
            'estimated_repair_time': diagnosis.estimated_time,
        }

    def overlay_repair_instructions(self, equipment_id, step_number):
        """Overlay repair instructions in AR"""
        instructions = self.equipment_db.get_repair_steps(equipment_id)
        step = instructions[step_number]

        self.ar_overlay.show({
            'type': 'step_instruction',
            'text': step.description,
            'highlight_parts': step.target_parts,  # Highlight target parts
            'arrows': step.directional_hints,       # Directional arrows
            'safety_warnings': step.warnings,       # Safety warning display
            'video_guide': step.video_url,           # Reference video
        })

    async def connect_remote_expert(self, issue_description):
        """AR-shared connection with a remote expert"""
        session = await self.remote_expert.connect()
        # Expert views the on-site AR feed in real time
        # Draws annotations on AR to provide instructions
        session.share_ar_view(
            enable_annotation=True,
            enable_voice=True,
            enable_3d_pointer=True,
        )
        return session
```

---

## 7. 3D Gaussian Splatting and NeRF for XR

### 3D Reconstruction of Real Spaces for XR

```
+-----------------------------------------------------------+
|  3D Reconstruction Technologies for XR                     |
+-----------------------------------------------------------+
|                                                           |
|  Capture (Smartphone/Drone)                               |
|       |                                                   |
|       v                                                   |
|  +----------------------+                                  |
|  | SfM (COLMAP)         |  Camera Pose Estimation          |
|  +----------------------+                                  |
|       |                                                   |
|       v                                                   |
|  +----------------------+  +----------------------+        |
|  | NeRF                 |  | 3D Gaussian          |        |
|  | (Implicit            |  | Splatting             |        |
|  |  Representation)     |  | (Explicit             |        |
|  | High quality but slow|  |  Representation)      |        |
|  +----------------------+  | Real-time rendering   |        |
|                            +----------------------+        |
|       |                      |                            |
|       v                      v                            |
|  +------------------------------------------+              |
|  |  XR Experiences                           |              |
|  |  - Virtual Tourism (Remote 3D Walkthrough)|              |
|  |  - Real Estate VR Tours                   |              |
|  |  - Cultural Heritage Digital Archives     |              |
|  |  - Remote Collaboration Spaces            |              |
|  +------------------------------------------+              |
+-----------------------------------------------------------+
```

---

## 8. Anti-Patterns

### Anti-Pattern 1: Ignoring VR Sickness in Design

```
BAD:
- Frame rate drops below 60fps
- Forcing camera movement programmatically
- Movement with acceleration (sudden starts/stops)
- Fixing UI at the edges of the field of view

GOOD:
- Maintain 90fps or above at all times (use foveated rendering)
- Use teleportation or vignette effects for locomotion
- User-driven camera control
- Use spatially anchored UI instead of fixed UI
- Avoid accelerated movement; use constant velocity as the default
```

### Anti-Pattern 2: Tracking Loss in Edge Cases

```
BAD:
- No countermeasures when tracking is lost
  -> User's position suddenly jumps, causing VR sickness

GOOD:
- IMU (Inertial Measurement Unit) fallback estimation
- Detect tracking loss and notify the user
- Smoothly return to the last valid position
- Pre-detect environments prone to loss (dark rooms, reflective surfaces)
```

### Anti-Pattern 3: Designing Immersive Experiences Without Performance Testing

```
BAD:
- Testing only on development PC specs without testing on actual devices
- Using excessive real-time lighting and particles
- Not setting upper limits for texture sizes and polygon counts
- Continuously loading assets without memory management

GOOD:
- Regular performance testing on target devices
- Setting frame budgets
  +-- Quest 3: 72Hz -> 13.9ms/frame
  +-- Quest 3: 90Hz -> 11.1ms/frame
  +-- Vision Pro: 90Hz -> 11.1ms/frame
- Proper LOD (Level of Detail) configuration
- Using texture atlases and compressed formats
- Implementing occlusion culling
```

### Anti-Pattern 4: Ignoring Accessibility

```
BAD:
- Distinguishing information by color alone (not accommodating color vision diversity)
- Audio-only feedback (not accommodating hearing impairment)
- Requiring overly fine gestures (not accommodating motor disabilities)
- Designing only for standing use (not accommodating wheelchair users)

GOOD:
- Convey information using color + shape + text
- Multi-modal feedback: visual + haptic (controller vibration) + audio
- Provide alternative inputs for gestures (voice, controller, gaze)
- UI layout that is comfortable for seated use
- Comfort setting options to accommodate individual differences in motion sickness susceptibility
```

---

## 9. Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Low frame rate | GPU load too high | Introduce foveated rendering, set up LOD, reduce draw calls |
| Unstable tracking | Lighting/reflections in environment | Improve lighting conditions, add markers to textureless walls |
| Passthrough latency | Camera-to-display pipeline delay | Enable ASW/Timewarp, optimize latency |
| Poor hand tracking accuracy | Hand in dark area / occluded | Add supplementary lighting, fall back to controller |
| Slow app startup | Asset loading time | Async loading, asset streaming, use compressed textures |
| Rapid battery drain | High CPU/GPU usage | Dynamic render quality adjustment, lower frame rate when idle |
| Spatial audio localization off | Improper HRTF settings | Personalized HRTF, head size measurement, real-time updates |

### Performance Profiling Procedure

```
1. Measure Frame Timing
   +-- GPU time: Time spent on rendering
   +-- CPU time: Game logic, physics simulation
   +-- Check if total exceeds the frame budget

2. Identify Bottleneck
   +-- GPU bound -> Reduce draw calls, optimize shaders
   +-- CPU bound -> Optimize logic, use multithreading
   +-- Memory bound -> Compress textures, use memory pools

3. Optimization Priority
   +-- High: Maintain frame rate (prevent VR sickness)
   +-- Medium: Reduce memory usage (battery life)
   +-- Low: Reduce startup time (UX improvement)

4. Tools
   +-- Meta Quest: OVR Metrics Tool, RenderDoc
   +-- Vision Pro: Xcode Instruments, RealityKit Profiler
   +-- PC VR: NVIDIA Nsight, PIX for Windows
```

---

## 10. Best Practices

### Best Practices for XR App Development

1. **Performance First**: Prioritize frame rate over quality. Cut features if you cannot maintain 90fps
2. **User-Driven Locomotion**: Minimize forced camera movement. Use teleportation and vignette effects
3. **Comfortable Distances**: Place UI at 0.5m to 3m. Too close causes eye strain; too far makes it unreadable
4. **Gradual Immersion**: Increase immersion level gradually rather than starting with full immersion
5. **Safety Guards**: Implement physical obstacle warnings and boundary systems
6. **Cross-Platform Design**: Develop on an OpenXR base and abstract device-specific features
7. **Testing Diversity**: Test across various body sizes, room sizes, and lighting conditions

### UI Design Principles for VR Content

```
+-----------------------------------------------------------+
|  Recommended Spatial UI Placement                          |
+-----------------------------------------------------------+
|                                                           |
|  User's Field of View (120 deg horizontal x 100 deg       |
|  vertical)                                                |
|                                                           |
|       +---------- Comfort Zone -----------+               |
|       |                                   |               |
|       |    +-------------------------+    |               |
|       |    |  Main UI                |    |               |
|       |    |  Distance: 1.5-2.0m     |    |               |
|       |    |  Angle: Front +/-30 deg |    |               |
|       |    +-------------------------+    |               |
|       |                                   |               |
|  <----+-- Sub UI ------ Sub UI -----------+---->          |
|       |  Dist: 1.0m    Dist: 1.0m         |               |
|       |  Angle: +/-45 deg  Angle: +/-45 deg|              |
|       |                                   |               |
|       +-----------------------------------+               |
|                                                           |
|  Recommendations:                                         |
|  - Text size: At least 1.5 deg visual angle (~4cm @ 1.5m)|
|  - Button size: At least 5cm x 5cm (considering touch     |
|    precision)                                             |
|  - Important information: Place within the front comfort  |
|    zone                                                   |
|  - Secondary information: Place in periphery (confirmed   |
|    via gaze)                                              |
+-----------------------------------------------------------+
```

---

## FAQ

### Q1. Should I buy the Vision Pro?

As of 2024, it is still expensive ($3,499) for general consumers. It offers value for spatial computing developers, 3D video/design professionals, and early adopters. For general VR gaming purposes, the Quest 3 ($499) provides overwhelmingly better cost-performance.

### Q2. Can practical AR/VR apps be built with WebXR?

Simple AR filters and 3D viewers are sufficiently practical. Development is possible with Three.js + WebXR API, and the advantage is distribution via URL without going through an app store. However, GPU performance constraints are significant compared to native apps, making it unsuitable for complex MR experiences.

### Q3. What is the "killer app" for spatial computing?

The most promising candidates at present are: 1) Remote collaboration (meetings in shared spaces), 2) Spatial design (full-scale previews for architecture/interior design), 3) Education and training (surgical simulations, etc.), and 4) Entertainment (immersive experiences using physical space). Spatial dialogue with AI assistants is also a strong future candidate.

### Q4. What is the optimal learning path to start XR development?

Step 1: Learn the basics of Unity or Unreal Engine (fundamentals of 2D/3D game development). Step 2: Create a simple VR app using the XR Interaction Toolkit. Step 3: Test on Quest 3 (the most accessible development device). Step 4: Experience mobile AR with ARKit/ARCore. Step 5: Advance to sophisticated techniques such as spatial UI design and AI integration.

### Q5. What should companies consider when adopting XR?

Clarifying ROI is paramount. Identify challenges that "can only be solved with VR," not just "because it's VR." Demonstrate effectiveness through pilot projects and deploy incrementally. Also factor in operational costs for device management, charging, and hygiene. Wi-Fi infrastructure and IT department support must be prepared in advance.

### Q6. What is the difference between 6DoF and 3DoF, and how do I choose?

3DoF (3 Degrees of Freedom) tracks only rotation (pitch, yaw, roll) without tracking positional movement. It is suitable for passive experiences such as viewing 360-degree videos. 6DoF (6 Degrees of Freedom) tracks both rotation and positional movement (x, y, z), enabling walking around in a space and reaching out to grab objects. 6DoF is essential for interactive experiences. All current major devices (Quest 3, Vision Pro) support 6DoF.

---

## Summary

| Concept | Key Point |
|---------|-----------|
| AR/VR/MR/XR | Technologies along the reality-virtuality continuum |
| Vision Pro | Pioneer of spatial computing, Micro-OLED |
| Quest 3 | Most cost-effective MR device |
| SLAM | Simultaneous self-localization and environment mapping |
| Foveated Rendering | 60-70% GPU load reduction via AI gaze prediction |
| Spatial UI | User interfaces placed in 3D space |
| NeRF / 3D Gaussian Splatting | AI-powered 3D scene reconstruction |
| 6DoF | 6-degree-of-freedom tracking: position (x,y,z) + rotation (pitch,yaw,roll) |
| OpenXR | Standard API for cross-platform XR development |
| Hand Tracking | Natural input method without controllers |
| ASW/Timewarp | Frame interpolation technology to prevent VR sickness |

---

## Recommended Next Guides

- **02-emerging/01-robotics.md** — Robotics: Boston Dynamics, Figure
- **02-emerging/02-smart-home.md** — Smart Home: Matter, AI Appliances
- **01-computing/02-edge-ai.md** — Edge AI: NPU, Coral, Jetson

---

## References

1. **Apple — visionOS Developer Documentation** https://developer.apple.com/visionos/
2. **Meta Quest Developer Hub** https://developer.oculus.com/
3. **WebXR Device API — W3C** https://www.w3.org/TR/webxr/
4. **NeRF (Neural Radiance Fields) Original Paper** https://www.matthewtancik.com/nerf
5. **OpenXR Specification — Khronos Group** https://www.khronos.org/openxr/
6. **ARKit Documentation — Apple** https://developer.apple.com/documentation/arkit
7. **3D Gaussian Splatting Original Paper** https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
