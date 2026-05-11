# Robotics Guide

> A comprehensive guide to AI-era robotics including Boston Dynamics, Figure, and home robots

## What You Will Learn in This Chapter

1. **Robotics Fundamentals** -- Composition and roles of sensors, actuators, and control systems
2. **Major Robotics Companies** -- Technologies and strategies of Boston Dynamics, Figure, Tesla Optimus, and home robots
3. **AI-Robot Fusion** -- Innovation in robot control through Foundation Models
4. **Simulation and Transfer** -- Practical methods for Isaac Sim, MuJoCo, and Sim-to-Real
5. **Safety Design** -- Robot safety standards, defense in depth, and human-robot collaboration


## Prerequisites

Before reading this guide, familiarity with the following will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [AR/VR x AI Guide](./00-ar-vr-ai.md)

---

## 1. Basic Structure of Robotics

### Robot System Architecture

```
+-----------------------------------------------------------+
|                  Robot System Overview                      |
+-----------------------------------------------------------+
|                                                           |
|  +------------------+     +------------------+            |
|  | Perception       |     | Planning         |            |
|  | Camera, LiDAR    | --> | Path planning    |            |
|  | Tactile sensors  |     | Task planning    |            |
|  | IMU, Force       |     | Motion planning  |            |
|  +------------------+     +------------------+            |
|                                  |                        |
|                                  v                        |
|  +------------------+     +------------------+            |
|  | Learning         |     | Control          |            |
|  | Reinforcement    | <-> | PID control      |            |
|  | Imitation        |     | MPC              |            |
|  | Foundation model |     | Torque control   |            |
|  +------------------+     +------------------+            |
|                                  |                        |
|                                  v                        |
|                          +------------------+             |
|                          | Action           |             |
|                          | Motor, Hydraulic |             |
|                          | Gripper          |             |
|                          +------------------+             |
+-----------------------------------------------------------+
```

### Types and Applications of Sensors

```
+-----------------------------------------------------------+
|  Robot Sensor Taxonomy                                     |
+-----------------------------------------------------------+
|                                                           |
|  Vision                                                    |
|  +-- RGB Camera: Color and shape recognition              |
|  +-- Depth Camera (ToF/Structured Light): 3D perception   |
|  +-- Stereo Camera: Distance estimation via stereoscopy   |
|  +-- LiDAR: High-precision 3D mapping                    |
|  +-- Event Camera: Ultra-fast change detection            |
|      (Dynamic Vision)                                     |
|                                                           |
|  Force Sensing                                             |
|  +-- Force/Torque Sensor: Contact force detection         |
|  +-- Tactile Sensor: Surface texture and slip detection   |
|  +-- Pressure Sensor: Grasping force control              |
|  +-- Electronic Skin: Distributed full-body tactile       |
|      sensing (flexible surface)                           |
|                                                           |
|  Inertial                                                  |
|  +-- IMU (Accelerometer + Gyro): Pose and motion          |
|      detection                                            |
|  +-- Encoder: Precise joint angle measurement             |
|  +-- Magnetic Encoder: Non-contact angle detection        |
|                                                           |
|  Environmental                                             |
|  +-- Ultrasonic: Short-range obstacle detection           |
|  +-- Infrared: Heat source detection, proximity sensor    |
|  +-- Microphone Array: Sound source localization          |
+-----------------------------------------------------------+
```

### Types and Characteristics of Actuators

```
+-----------------------------------------------------------+
|  Comparison of Robot Actuators                              |
+-----------------------------------------------------------+
|                                                           |
|  Electric Motor (DC/BLDC)                                  |
|  +-- Easy precise control, high responsiveness            |
|  +-- Efficiency: 80-95%                                   |
|  +-- Use: Robot arms, humanoid joints                     |
|  +-- Adopted by Atlas (electric), Figure 02, Optimus     |
|                                                           |
|  Hydraulic Actuator                                        |
|  +-- High output, heavy object manipulation               |
|  +-- Efficiency: 40-60%                                   |
|  +-- Use: Construction machinery, old Atlas (hydraulic)   |
|  +-- Oil leakage and maintenance are challenges           |
|                                                           |
|  Pneumatic Actuator                                        |
|  +-- Lightweight, safe (low output)                       |
|  +-- Efficiency: 20-30%                                   |
|  +-- Use: Soft robotics, grippers                         |
|                                                           |
|  Artificial Muscle (SMA/EAP)                               |
|  +-- Lightweight, flexible, biomimetic motion             |
|  +-- Efficiency: 1-10% (current)                          |
|  +-- Use: Research stage, soft robotics                   |
|                                                           |
|  Quasi-Direct Drive Actuator (QDD)                         |
|  +-- Low gear ratio with high backdrivability             |
|  +-- Can dissipate force on collision (improved safety)   |
|  +-- Adopted by Unitree H1/G1, MIT Cheetah               |
+-----------------------------------------------------------+
```

---

## 2. Major Robotics Companies and Products

### Company and Product Comparison Table

| Company | Representative Product | Category | DOF | AI Approach | Status (2025) |
|---------|----------------------|----------|-----|-------------|---------------|
| Boston Dynamics | Atlas (Electric) | Humanoid | 28+ | RL + MPC | Research / Commercial Demo |
| Boston Dynamics | Spot | Quadruped | 17 | Autonomous Navigation | Commercial Deployment |
| Figure | Figure 02 | Humanoid | 40+ | OpenAI Model Integration | Prototype |
| Tesla | Optimus Gen 2 | Humanoid | 28 | FSD Technology Transfer | In Development |
| Unitree | H1/G1 | Humanoid | 23-40 | Reinforcement Learning | Commercial Launch |
| Agility Robotics | Digit | Humanoid | 16+ | Warehouse-Specialized | Amazon Pilot |
| 1X Technologies | NEO Beta | Humanoid | 25+ | OpenAI-Backed | Prototype |
| Apptronik | Apollo | Humanoid | 30+ | Mercedes-Benz Partnership | Factory Testing |
| iRobot | Roomba j9+ | Home Cleaning | - | Object Recognition AI | General Sale |
| Sony | aibo (ERS-1000) | Pet Robot | 22 | Emotion AI | General Sale |

### Generational Evolution of Humanoid Robots

```
+-----------------------------------------------------------+
|  Evolution of Humanoid Robots                              |
+-----------------------------------------------------------+
|                                                           |
|  Gen 1 (2000-2015): ASIMO, HRP                           |
|  |██|                                                     |
|  ZMP walking, pre-programmed motions, limited environment |
|                                                           |
|  Gen 2 (2015-2022): Atlas (Hydraulic), Pepper             |
|  |██████|                                                 |
|  Dynamic walking, backflips, basic autonomy               |
|                                                           |
|  Gen 3 (2022-2025): Atlas (Electric), Figure, Optimus    |
|  |████████████|                                           |
|  Electric actuators, AI vision, task learning             |
|                                                           |
|  Gen 4 (2025-): Foundation Model Integrated               |
|  |████████████████████|                                   |
|  Language-instructed motion, general task execution,       |
|  self-learning                                            |
+-----------------------------------------------------------+
```

### AI Strategy Comparison by Company

```
+-----------------------------------------------------------+
|  Humanoid Robot AI Strategy Comparison                      |
+-----------------------------------------------------------+
|                                                           |
|  Boston Dynamics (Atlas)                                   |
|  +-- Control: MPC + Reinforcement Learning hybrid         |
|  +-- Perception: Proprietary vision pipeline              |
|  +-- Learning: Sim RL -> Real-world transfer              |
|  +-- Strength: Locomotion performance, robustness         |
|                                                           |
|  Figure (Figure 02)                                        |
|  +-- Control: Foundation Model (OpenAI VLM) for           |
|      high-level planning                                  |
|  +-- Perception: Camera + Language understanding          |
|  +-- Learning: Teleop + Imitation learning + RL           |
|  +-- Strength: General tasks via natural language         |
|                                                           |
|  Tesla (Optimus)                                           |
|  +-- Control: FSD (Full Self-Driving) technology          |
|      transfer                                             |
|  +-- Perception: Camera only (no LiDAR, same philosophy  |
|      as FSD)                                              |
|  +-- Learning: Large-scale data + Neural networks         |
|  +-- Strength: Scalability, cost reduction                |
|                                                           |
|  Unitree (H1/G1)                                           |
|  +-- Control: Reinforcement Learning (trained in          |
|      Isaac Gym)                                           |
|  +-- Perception: LiDAR + Camera + IMU                     |
|  +-- Learning: Sim-to-Real transfer                       |
|  +-- Strength: Low cost ($90,000+), agile motion          |
+-----------------------------------------------------------+
```

---

## 3. AI x Robotics Fusion

### Code Example 1: Basic Robot Control with ROS 2

```python
# Basic robot node using ROS 2 (Robot Operating System)
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan
import numpy as np

class ObstacleAvoidanceNode(Node):
    def __init__(self):
        super().__init__('obstacle_avoidance')

        # Subscribe to LiDAR data
        self.scan_sub = self.create_subscription(
            LaserScan, '/scan', self.scan_callback, 10
        )

        # Publish velocity commands
        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.min_distance = 0.5  # Minimum safe distance (meters)
        self.get_logger().info('Obstacle avoidance node started')

    def scan_callback(self, msg: LaserScan):
        """Detect obstacles from LiDAR scan data and avoid them"""
        ranges = np.array(msg.ranges)
        ranges = np.where(np.isinf(ranges), 10.0, ranges)

        # Front 180 degrees of scan data
        front_ranges = ranges[len(ranges)//4 : 3*len(ranges)//4]

        cmd = Twist()

        if np.min(front_ranges) < self.min_distance:
            # Obstacle detected -> rotate
            cmd.angular.z = 0.5  # Turn left
            cmd.linear.x = 0.0
            self.get_logger().warn(
                f'Obstacle detected: {np.min(front_ranges):.2f}m -- avoiding'
            )
        else:
            # Safe -> move forward
            cmd.linear.x = 0.3
            cmd.angular.z = 0.0

        self.cmd_pub.publish(cmd)

def main():
    rclpy.init()
    node = ObstacleAvoidanceNode()
    rclpy.spin(node)
    rclpy.shutdown()
```

### Code Example 2: Imitation Learning

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

class RobotPolicy(nn.Module):
    """Policy network that predicts actions from image observations"""
    def __init__(self, action_dim=7):
        super().__init__()
        # Vision encoder
        self.vision = nn.Sequential(
            nn.Conv2d(3, 32, 3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, 64, 3, stride=2, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(4),
            nn.Flatten(),
        )
        # Action prediction head
        self.policy = nn.Sequential(
            nn.Linear(64 * 16, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, action_dim),  # [dx, dy, dz, droll, dpitch, dyaw, gripper]
        )

    def forward(self, image):
        features = self.vision(image)
        action = self.policy(features)
        return action

# Learn from human demonstration data
class DemonstrationDataset(torch.utils.data.Dataset):
    def __init__(self, demo_path):
        self.demos = load_demonstrations(demo_path)
        # demo: [(image, action), (image, action), ...]

    def __len__(self):
        return len(self.demos)

    def __getitem__(self, idx):
        image, action = self.demos[idx]
        return torch.tensor(image).float(), torch.tensor(action).float()

# Training loop
policy = RobotPolicy().to(device)
optimizer = torch.optim.Adam(policy.parameters(), lr=1e-4)

for epoch in range(100):
    for images, expert_actions in dataloader:
        predicted_actions = policy(images.to(device))
        loss = nn.MSELoss()(predicted_actions, expert_actions.to(device))
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

### Code Example 3: Diffusion Policy (Diffusion Model-Based Action Generation)

```python
import torch
import torch.nn as nn

class DiffusionPolicy(nn.Module):
    """
    Diffusion Policy: Robot action generation using diffusion models
    Generates action trajectories by gradually denoising from noise

    Advantages:
    - Can represent multimodal action distributions
    - High success rate in complex manipulation tasks
    - Most notable method in robotics for 2024-2025
    """
    def __init__(self, obs_dim=512, action_dim=7, action_horizon=16,
                 n_diffusion_steps=100):
        super().__init__()
        self.action_dim = action_dim
        self.action_horizon = action_horizon
        self.n_steps = n_diffusion_steps

        # Observation encoder (image -> features)
        self.obs_encoder = nn.Sequential(
            nn.Conv2d(3, 64, 3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(64, 128, 3, stride=2, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(4),
            nn.Flatten(),
            nn.Linear(128 * 16, obs_dim),
        )

        # Noise prediction network (1D U-Net-like structure)
        self.noise_pred_net = nn.Sequential(
            nn.Linear(action_dim * action_horizon + obs_dim + 1, 512),
            nn.ReLU(),
            nn.Linear(512, 512),
            nn.ReLU(),
            nn.Linear(512, action_dim * action_horizon),
        )

    def forward(self, obs, noisy_action, timestep):
        """Noise prediction: estimate noise from current observation and corrupted action"""
        obs_feat = self.obs_encoder(obs)
        noisy_flat = noisy_action.flatten(start_dim=1)
        t_embed = timestep.float().unsqueeze(1) / self.n_steps

        x = torch.cat([noisy_flat, obs_feat, t_embed], dim=1)
        noise_pred = self.noise_pred_net(x)
        return noise_pred.view(-1, self.action_horizon, self.action_dim)

    @torch.no_grad()
    def generate_action(self, obs):
        """Inference: gradually denoise action trajectory from noise"""
        batch_size = obs.shape[0]
        device = obs.device

        # Start from random noise
        action = torch.randn(
            batch_size, self.action_horizon, self.action_dim, device=device
        )

        # DDPM denoising process
        for t in reversed(range(self.n_steps)):
            timestep = torch.full((batch_size,), t, device=device)
            noise_pred = self.forward(obs, action, timestep)

            # Denoising step (simplified)
            alpha = 1 - 0.02 * t / self.n_steps
            action = (action - (1 - alpha) * noise_pred) / alpha.sqrt()

            if t > 0:
                action += 0.1 * torch.randn_like(action)

        return action  # (batch, horizon, action_dim)

# Training
policy = DiffusionPolicy().to(device)
optimizer = torch.optim.AdamW(policy.parameters(), lr=1e-4)

for epoch in range(100):
    for obs, expert_actions in dataloader:
        # Add noise at random timesteps
        t = torch.randint(0, policy.n_steps, (obs.shape[0],), device=device)
        noise = torch.randn_like(expert_actions)
        noisy_actions = expert_actions + noise * (t.float() / policy.n_steps).unsqueeze(1).unsqueeze(2)

        # Learn noise prediction
        noise_pred = policy(obs.to(device), noisy_actions.to(device), t)
        loss = nn.MSELoss()(noise_pred, noise.to(device))

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

### Code Example 4: Language-Instructed Robot Control (Foundation Model Integration)

```python
# Conceptual code for robot control using VLM (Vision-Language Model)
class VLMRobotController:
    """
    Controller that understands language instructions,
    assesses the situation from camera images, and
    generates robot actions
    """
    def __init__(self):
        self.vlm = load_vlm("rt-2-x")  # Robotics Transformer
        self.low_level_controller = MotorController()

    def execute_instruction(self, instruction: str, camera_image):
        """
        Example: instruction = "Pick up the red cup on the table and place it on the shelf"
        """
        # VLM understands image and instruction, generates action tokens
        action_tokens = self.vlm.predict(
            image=camera_image,
            instruction=instruction,
        )
        # action_tokens -> [dx, dy, dz, rx, ry, rz, gripper_open]

        # Convert to motor commands via low-level controller
        for action in action_tokens:
            joint_torques = self.low_level_controller.inverse_kinematics(action)
            self.low_level_controller.execute(joint_torques)

        return action_tokens

# Google RT-2-X approach:
# 1. Large language model (PaLM-E) for language understanding
# 2. Vision encoder for environment perception
# 3. Generate discretized actions as action tokens
# 4. Execute with demo-refined (pre-trained) model
```

---

## 4. Comparison of Robot Control Methods

### Control Methods Comparison Table

| Method | Application | Generality | Safety | Training Cost | Example |
|--------|-------------|-----------|--------|--------------|---------|
| PID Control | Joint angle control | Low | High | None | Industrial robot arms |
| MPC (Model Predictive Control) | Walking / Locomotion | Medium | High | Low | Boston Dynamics Atlas |
| Reinforcement Learning (RL) | Complex motion acquisition | High | Medium | High (sim-to-real) | Walking, Manipulation |
| Imitation Learning (IL) | Task-specific motions | Medium | Medium | Medium (demo collection) | Assembly, Cooking |
| Diffusion Policy | Precise manipulation | High | Medium | Medium | Folding, Assembly |
| Foundation Model (FM) | General tasks | Very High | In Development | High (large-scale training) | RT-2, Figure + OpenAI |

### Code Example 5: Robot Walking via Reinforcement Learning (Isaac Gym)

```python
# Reinforcement learning for quadruped walking using NVIDIA Isaac Gym
import isaacgym
from isaacgym import gymapi, gymutil
import torch

class QuadrupedEnv:
    """Parallel simulation environment for quadruped walking robot"""

    def __init__(self, num_envs=4096):
        self.num_envs = num_envs
        self.gym = gymapi.acquire_gym()

        # Simulation settings
        sim_params = gymapi.SimParams()
        sim_params.dt = 1.0 / 200.0  # 200Hz
        sim_params.substeps = 2
        sim_params.physx.solver_type = 1
        sim_params.physx.num_position_iterations = 4
        sim_params.physx.num_velocity_iterations = 0
        sim_params.physx.use_gpu = True

        self.sim = self.gym.create_sim(0, 0, gymapi.SIM_PHYSX, sim_params)

        # Create 4096 environments in parallel (simultaneous GPU simulation)
        self._create_envs()

    def _create_envs(self):
        """Create parallel environments"""
        asset_root = "/path/to/urdf/"
        asset_file = "a1_robot.urdf"

        # Load robot model
        asset = self.gym.load_asset(self.sim, asset_root, asset_file)

        for i in range(self.num_envs):
            env = self.gym.create_env(self.sim, ...)
            self.gym.create_actor(env, asset, ...)

    def step(self, actions):
        """Execute one step (advance all environments simultaneously)"""
        # actions: (num_envs, 12) -- 3 joints per leg x 4 legs
        self.gym.set_dof_position_target_tensor(self.sim, actions)
        self.gym.simulate(self.sim)
        self.gym.fetch_results(self.sim, True)

        obs = self._compute_observations()
        rewards = self._compute_rewards()
        dones = self._check_termination()

        return obs, rewards, dones

    def _compute_rewards(self):
        """Reward function"""
        # Reward for forward velocity
        forward_reward = self.base_velocity[:, 0] * 2.0

        # Energy penalty (encourage energy-efficient walking)
        energy_penalty = -0.005 * torch.sum(self.torques ** 2, dim=1)

        # Posture stability (falling penalty)
        orientation_penalty = -1.0 * torch.sum(
            (self.base_orientation[:, :2]) ** 2, dim=1
        )

        # Foot contact pattern (encourage diagonal gait)
        gait_reward = self._compute_gait_reward()

        return forward_reward + energy_penalty + orientation_penalty + gait_reward

# Train with PPO (Proximal Policy Optimization)
# 4096 parallel environments -> hundreds of millions of steps in 1 hour
# -> Walking can be executed immediately on the real robot
```

### Code Example 6: Teleoperation Demo Collection

```python
import numpy as np
from dataclasses import dataclass
from typing import List
import h5py

@dataclass
class DemoStep:
    """One step of a demonstration"""
    timestamp: float
    image: np.ndarray       # (H, W, 3) RGB image
    depth: np.ndarray       # (H, W) Depth image
    joint_positions: np.ndarray   # Joint angles
    joint_velocities: np.ndarray  # Joint velocities
    ee_position: np.ndarray      # End-effector position [x, y, z]
    ee_orientation: np.ndarray   # End-effector orientation [qx, qy, qz, qw]
    gripper_state: float         # Gripper open/close (0-1)

class TeleopDataCollector:
    """Demonstration data collection via teleoperation"""

    def __init__(self, robot, camera, save_dir="demos"):
        self.robot = robot
        self.camera = camera
        self.save_dir = save_dir
        self.current_demo: List[DemoStep] = []
        self.demo_count = 0

    def start_recording(self):
        """Start demo recording"""
        self.current_demo = []
        print("Demo recording started.")

    def record_step(self):
        """Record the current robot state"""
        step = DemoStep(
            timestamp=time.time(),
            image=self.camera.get_rgb(),
            depth=self.camera.get_depth(),
            joint_positions=self.robot.get_joint_positions(),
            joint_velocities=self.robot.get_joint_velocities(),
            ee_position=self.robot.get_ee_position(),
            ee_orientation=self.robot.get_ee_orientation(),
            gripper_state=self.robot.get_gripper_state(),
        )
        self.current_demo.append(step)

    def save_demo(self, task_name: str):
        """Save demo data in HDF5 format"""
        filename = f"{self.save_dir}/{task_name}_demo_{self.demo_count:04d}.hdf5"

        with h5py.File(filename, 'w') as f:
            n_steps = len(self.current_demo)
            f.attrs['task'] = task_name
            f.attrs['n_steps'] = n_steps

            # Save each data field in batch
            images = np.stack([s.image for s in self.current_demo])
            f.create_dataset('images', data=images, compression='gzip')

            actions = np.stack([
                np.concatenate([s.ee_position, s.ee_orientation, [s.gripper_state]])
                for s in self.current_demo
            ])
            f.create_dataset('actions', data=actions)

            joint_pos = np.stack([s.joint_positions for s in self.current_demo])
            f.create_dataset('joint_positions', data=joint_pos)

        self.demo_count += 1
        print(f"Demo saved: {filename} ({n_steps} steps)")

# Teleop devices
# - VR Controller (Meta Quest): Directly map hand position/orientation
# - 3D Mouse (SpaceMouse): 6DoF input device
# - Leader-Follower: Operate using two robot arms
# - Apple Vision Pro: Control robot via hand tracking
```

---

## 5. Simulation and Sim-to-Real Transfer

### Simulator Comparison

| Simulator | Developer | GPU Parallel | Physics Engine | Primary Use | License |
|-----------|-----------|-------------|---------------|-------------|---------|
| Isaac Gym/Lab | NVIDIA | Thousands of envs | PhysX | Reinforcement Learning | Free |
| MuJoCo | Google | Limited | Proprietary | Research | Apache 2.0 |
| PyBullet | Coumans | None | Bullet | Education / Research | MIT |
| Gazebo | Open Robotics | None | ODE/DART | ROS Integration | Apache 2.0 |
| Isaac Sim | NVIDIA | Supported | PhysX 5 | Photorealistic | Free |
| Genesis | Research Team | Tens of thousands | Proprietary | Ultra-large-scale RL | Research |

### Sim-to-Real Transfer Framework

```
+-----------------------------------------------------------+
|  Sim-to-Real Transfer Overview                             |
+-----------------------------------------------------------+
|                                                           |
|  Simulation                                                |
|  +----------------------------------------------+        |
|  |                                              |        |
|  |  1. Domain Randomization                     |        |
|  |     Friction: 0.2-1.0                        |        |
|  |     Mass: +/-20%                             |        |
|  |     Gravity: 9.6-10.2 m/s^2                  |        |
|  |     Sensor noise: +/-5%                      |        |
|  |     Visual: Randomize color, lighting,       |        |
|  |            texture                           |        |
|  |     Latency: 0-30ms random control delay     |        |
|  |                                              |        |
|  |  2. Large-Scale Parallel Training            |        |
|  |     Isaac Gym: 4096 envs -> ~hundreds of     |        |
|  |     millions of steps in 1 hour              |        |
|  |                                              |        |
|  |  3. Policy Training                          |        |
|  |     PPO / SAC / TD3                          |        |
|  +----------------------------------------------+        |
|                    |                                      |
|                    v                                      |
|  Transfer (Reducing the Sim-to-Real Gap)                  |
|  +----------------------------------------------+        |
|  |  System Identification: Precise measurement   |        |
|  |  of real robot parameters                     |        |
|  |  Residual Learning: Fine-tuning with real     |        |
|  |  robot data                                   |        |
|  |  Adaptive Control: Online adaptation to real  |        |
|  |  environment                                  |        |
|  +----------------------------------------------+        |
|                    |                                      |
|                    v                                      |
|  Real Robot                                               |
|  +----------------------------------------------+        |
|  |  Fine-tuning with small amount of real data   |        |
|  |  Apply safety filters                         |        |
|  |  Gradual difficulty escalation                |        |
|  +----------------------------------------------+        |
+-----------------------------------------------------------+
```

---

## 6. Home Robots

### Code Example 7: Roomba-Style Coverage Planning Algorithm

```python
import numpy as np
from enum import Enum

class CoverageState(Enum):
    SPIRAL = "spiral"
    WALL_FOLLOW = "wall_follow"
    RANDOM = "random"

class CoveragePlanner:
    """Coverage planning for home cleaning robots"""

    def __init__(self, grid_size=(100, 100)):
        self.grid = np.zeros(grid_size, dtype=bool)  # Cleaned area map
        self.obstacles = np.zeros(grid_size, dtype=bool)
        self.position = (50, 50)
        self.heading = 0  # 0-359 degrees
        self.state = CoverageState.SPIRAL

    def plan_next_action(self, bumper_hit, cliff_detected):
        """Determine the next action based on sensor input"""
        if cliff_detected:
            return self._backup_and_turn(180)

        if bumper_hit:
            self.state = CoverageState.WALL_FOLLOW
            return self._wall_follow()

        if self.state == CoverageState.SPIRAL:
            return self._spiral_outward()

        if self._coverage_percentage() > 0.9:
            return self._move_to_uncovered()

        return self._random_bounce()

    def _coverage_percentage(self):
        """Percentage of cleaned area"""
        cleanable = ~self.obstacles
        return np.sum(self.grid & cleanable) / np.sum(cleanable)

    def _spiral_outward(self):
        """Spiral movement pattern"""
        # Move in a spiral from center outward
        # Transition state when hitting an obstacle
        pass

    def _wall_follow(self):
        """Wall-following movement (clean room edges)"""
        pass

    def _move_to_uncovered(self):
        """Move to uncleaned area"""
        uncovered = ~self.grid & ~self.obstacles
        if np.any(uncovered):
            target = find_nearest_uncovered(self.position, uncovered)
            return plan_path_to(self.position, target)
```

### Code Example 8: Inverse Kinematics for a Robot Arm

```python
import numpy as np

class SimpleRobotArm:
    """Inverse kinematics for a 2-link robot arm"""

    def __init__(self, l1=0.3, l2=0.25):
        self.l1 = l1  # Link 1 length (m)
        self.l2 = l2  # Link 2 length (m)

    def forward_kinematics(self, theta1, theta2):
        """Forward kinematics: joint angles -> end-effector position"""
        x = self.l1 * np.cos(theta1) + self.l2 * np.cos(theta1 + theta2)
        y = self.l1 * np.sin(theta1) + self.l2 * np.sin(theta1 + theta2)
        return x, y

    def inverse_kinematics(self, x, y):
        """Inverse kinematics: target position -> joint angles"""
        d = (x**2 + y**2 - self.l1**2 - self.l2**2) / (2 * self.l1 * self.l2)

        if abs(d) > 1:
            raise ValueError("Target position is outside the workspace")

        theta2 = np.arctan2(np.sqrt(1 - d**2), d)  # Elbow-up solution
        theta1 = np.arctan2(y, x) - np.arctan2(
            self.l2 * np.sin(theta2),
            self.l1 + self.l2 * np.cos(theta2)
        )

        return theta1, theta2

    def plan_trajectory(self, start, end, steps=50):
        """Smooth trajectory planning from start to end"""
        trajectory = []
        for t in np.linspace(0, 1, steps):
            # Cubic interpolation for smooth motion
            s = 3*t**2 - 2*t**3  # smoothstep
            x = start[0] + s * (end[0] - start[0])
            y = start[1] + s * (end[1] - start[1])
            theta1, theta2 = self.inverse_kinematics(x, y)
            trajectory.append((theta1, theta2))
        return trajectory
```

### Code Example 9: 6-DOF Robot Arm Kinematics (DH Method)

```python
import numpy as np

def dh_transform(theta, d, a, alpha):
    """
    Denavit-Hartenberg transformation matrix
    theta: Joint angle (revolute joint)
    d: Link offset
    a: Link length
    alpha: Link twist angle
    """
    ct, st = np.cos(theta), np.sin(theta)
    ca, sa = np.cos(alpha), np.sin(alpha)

    return np.array([
        [ct, -st*ca,  st*sa, a*ct],
        [st,  ct*ca, -ct*sa, a*st],
        [0,   sa,     ca,    d   ],
        [0,   0,      0,     1   ],
    ])

class Robot6DOF:
    """6-DOF robot arm (Puma 560-style DH parameters)"""

    def __init__(self):
        # DH parameters [d, a, alpha] (theta is variable)
        self.dh_params = [
            [0.670, 0,     np.pi/2],   # Joint 1
            [0,     0.432, 0],          # Joint 2
            [0,     0.020, np.pi/2],    # Joint 3
            [0.432, 0,    -np.pi/2],    # Joint 4
            [0,     0,     np.pi/2],    # Joint 5
            [0.056, 0,     0],          # Joint 6
        ]

    def forward_kinematics(self, joint_angles):
        """Forward kinematics: 6 joint angles -> 4x4 end-effector transform"""
        T = np.eye(4)
        for i, (d, a, alpha) in enumerate(self.dh_params):
            T = T @ dh_transform(joint_angles[i], d, a, alpha)
        return T

    def jacobian(self, joint_angles, delta=1e-6):
        """Numerical Jacobian: joint velocities -> end-effector velocities"""
        J = np.zeros((6, 6))
        T0 = self.forward_kinematics(joint_angles)
        pos0 = T0[:3, 3]

        for i in range(6):
            angles_plus = joint_angles.copy()
            angles_plus[i] += delta
            T_plus = self.forward_kinematics(angles_plus)

            # Position Jacobian
            J[:3, i] = (T_plus[:3, 3] - pos0) / delta

            # Orientation Jacobian (simplified)
            dR = T_plus[:3, :3] @ T0[:3, :3].T
            J[3:, i] = np.array([dR[2, 1], dR[0, 2], dR[1, 0]]) / delta

        return J

    def inverse_kinematics_numerical(self, target_pos, target_orient=None,
                                      max_iter=100, tol=1e-4):
        """Numerical inverse kinematics (Jacobian-based)"""
        q = np.zeros(6)  # Initial posture

        for iteration in range(max_iter):
            T_current = self.forward_kinematics(q)
            pos_error = target_pos - T_current[:3, 3]

            if np.linalg.norm(pos_error) < tol:
                return q

            J = self.jacobian(q)
            J_pos = J[:3, :]  # Position Jacobian only

            # Damped pseudoinverse (singularity avoidance)
            lambda_sq = 0.01
            J_pinv = J_pos.T @ np.linalg.inv(
                J_pos @ J_pos.T + lambda_sq * np.eye(3)
            )

            dq = J_pinv @ pos_error
            q += dq * 0.5  # Step size

        return q
```

---

## 7. Safety Design and Standards

### Robot Safety Architecture

```
+-----------------------------------------------------------+
|  Robot Safety Defense-in-Depth Architecture                 |
+-----------------------------------------------------------+
|                                                           |
|  Layer 5: Environmental Design                            |
|  +-- Physical separation of work zones (fences,          |
|      light curtains)                                      |
|  +-- Speed and force limit zone configuration             |
|  +-- Emergency stop button placement                      |
|                                                           |
|  Layer 4: AI Safety Filter                                |
|  +-- Anomalous behavior detection (output check of       |
|      trained models)                                      |
|  +-- Predictive collision avoidance (trajectory           |
|      prediction + evasive action)                         |
|  +-- Rejection of actions with high uncertainty           |
|                                                           |
|  Layer 3: Software Safety Constraints                     |
|  +-- Speed limit: max_velocity = 1.5 m/s (when           |
|      coexisting with humans)                              |
|  +-- Force limit: max_force = 150 N (ISO/TS 15066        |
|      compliant)                                           |
|  +-- Workspace limits (range of motion restriction)       |
|                                                           |
|  Layer 2: Hardware Safety                                 |
|  +-- Collision detection via force/torque sensors         |
|  +-- Backdrivable actuators (dissipate force on           |
|      collision)                                           |
|  +-- Current limiting (physical torque limitation)        |
|                                                           |
|  Layer 1: Emergency Stop (E-Stop)                         |
|  +-- Hardware E-Stop (physical button)                    |
|  +-- Software E-Stop (fail-safe even on communication     |
|      loss)                                                |
|  +-- SIL 3 (Safety Integrity Level 3) compliant           |
|                                                           |
|  Lower layers must always be able to override upper       |
|  layers                                                   |
+-----------------------------------------------------------+
```

### Key Robot Safety Standards

| Standard | Content | Target |
|----------|---------|--------|
| ISO 10218-1/2 | Safety requirements for industrial robots | Factory robots |
| ISO/TS 15066 | Collaborative robot safety (force/speed limits) | Cobots |
| ISO 13482 | Safety for personal care robots | Home robots |
| IEC 61508 | General functional safety standard | All safety systems |
| ISO 26262 | Automotive functional safety | Autonomous vehicles |
| ISO/DIS 22166 | Safety for autonomous mobile robots | AMR |

---

## 8. Industrial Applications of Robotics

### Robot Adoption by Industry Sector

```
+-----------------------------------------------------------+
|  Industrial Robotics Adoption Sectors                      |
+-----------------------------------------------------------+
|                                                           |
|  Manufacturing                                             |
|  +-- Automotive assembly line: Welding, painting,         |
|      assembly                                             |
|  +-- Electronics: SMT mounting, inspection                |
|  +-- Food processing: Picking, packaging                  |
|  +-- BMW/Figure 02: Humanoid pilot deployment in          |
|      factories                                            |
|                                                           |
|  Logistics and Warehousing                                 |
|  +-- Amazon: Proteus (autonomous mobile robot)            |
|  +-- Amazon: Digit (Agility Robotics, box handling)       |
|  +-- Sorting: Piece-picking robots                        |
|  +-- Autonomous Mobile Robots (AMR): Fetch, Locus         |
|                                                           |
|  Agriculture                                               |
|  +-- Harvesting robots: Strawberry and tomato picking     |
|  +-- Weeding robots: Weed identification via camera + AI  |
|  +-- Drones: Pesticide spraying, crop monitoring          |
|                                                           |
|  Healthcare and Nursing Care                               |
|  +-- Surgical robots: da Vinci (intuitive operation)      |
|  +-- Rehabilitation: Exoskeleton robots                   |
|  +-- Transport: In-hospital goods delivery robots         |
|                                                           |
|  Construction                                              |
|  +-- Spot (Boston Dynamics): Construction site patrol     |
|      and inspection                                       |
|  +-- 3D Printing: Concrete layering                       |
|  +-- Demolition robots: Remote operation in hazardous     |
|      areas                                                |
+-----------------------------------------------------------+
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Ignoring the Simulation-Reality Gap

```
BAD: Works perfectly in simulation (MuJoCo, Isaac Sim)
     -> Transfer directly to real robot
     -> Doesn't work at all in reality (sim-to-real gap)

GOOD: Apply Sim-to-Real transfer countermeasures
    1. Domain Randomization: Randomize physical parameters
       - Friction coefficient: 0.3-0.8
       - Gravity: 9.6-10.0 m/s^2
       - Mass: +/-10%
       - Sensor noise: +/-5%
       - Control latency: 0-30ms
    2. System Identification: Precisely measure real robot parameters
    3. Gradual transfer: sim -> sim-to-real -> small real-world data
    4. Residual Learning: Base policy in sim -> learn the delta with real data
```

### Anti-Pattern 2: AI Control Without Safety Mechanisms

```
BAD: Send AI model output directly to motors
     -> Unexpected motion damages people or objects

GOOD: Multi-layered safety architecture
    Layer 1: AI Policy (trained model)
    Layer 2: Safety Filter (speed/force upper limits)
    Layer 3: Collision Detection (force sensor thresholds)
    Layer 4: Emergency Stop (hardware E-stop)

    Layers 2-4 must always be able to override Layer 1
```

### Anti-Pattern 3: Overreliance on End-to-End

```
BAD: Train a single model from image input to action output
     -> Black box with no visibility into what's happening
     -> Impossible to debug, impossible to verify safety

GOOD: Modular architecture + Foundation Models
    1. Perception module: Object recognition, environment understanding
    2. Planning module: Task decomposition, action planning
    3. Control module: Low-level motor control
    Make each module's inputs/outputs verifiable
    Use foundation models at the planning level (conventional methods for control)
```

### Anti-Pattern 4: Neglecting Data Collection

```
BAD: Assume simulation data alone is sufficient
     -> Cannot cover the diversity of real environments

GOOD: Systematic data collection pipeline
    1. Teleoperation: Humans demo via VR/leader-follower
    2. Autonomous exploration: Robot self-collects data within safe bounds
    3. Multi-robot: Parallel data collection with multiple units
    4. Data augmentation: Visual randomization, noise injection
    Target: 50-200 demos per task (Diffusion Policy benchmark)
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main processing logic"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Get processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Test
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation to add the following features.

```python
# Exercise 2: Advanced patterns
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for advanced patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Remove by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Test
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm time complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## FAQ

### Q1. When will humanoid robots become widespread in homes?

As of 2025, we are in the early stages of commercial deployment. Industrial applications are leading, such as the Figure 02 pilot at BMW factories and Digit pilot testing at Amazon. Initial home products are predicted for the early 2030s, with prices reaching car-level ($20,000-$35,000) by the late 2030s. Tesla Optimus aims for mass production, but the technical challenges for general-purpose home robots (flexible object manipulation, adaptation to unknown environments) remain significant.

### Q2. What skill sets are needed for robot development?

Hardware (mechanics, electronic circuits), software (C++/Python, ROS 2), control engineering (PID, MPC), AI (reinforcement learning, computer vision), and mathematics (linear algebra, optimization) are needed. You don't need to cover everything yourself -- team development is the norm. As of 2025, experience with imitation learning/Diffusion Policy implementation and reinforcement learning with Isaac Gym/Lab is particularly in demand.

### Q3. What is the relationship between ROS 2 and Isaac Sim?

ROS 2 is the standard framework for robot software (communication, sensor integration, path planning). Isaac Sim is NVIDIA's robot simulator that works in conjunction with ROS 2. The typical workflow is to perform simulation training in Isaac Sim and deploy to real robots via ROS 2. Isaac Lab (formerly Orbit) is a reinforcement learning-focused framework that runs on top of Isaac Sim.

### Q4. What is Diffusion Policy? Why is it attracting attention?

Diffusion Policy applies diffusion models (same principle as Stable Diffusion) to robot action generation. It generates actions by gradually denoising from noise. It can naturally handle multimodal action distributions -- "multiple correct answers for the same situation" -- which conventional imitation learning could not express. Since 2024, it has shown significantly higher success rates than conventional methods in precise manipulation tasks such as folding, assembly, and cooking.

### Q5. How can reinforcement learning training time be reduced?

GPU-parallel simulation using Isaac Gym/Lab is most effective. A single GPU can simulate over 4,096 environments simultaneously, enabling hundreds of millions of training steps in a few hours. Curriculum learning (gradually increasing difficulty from easy environments), reward shaping (staged reward design), and transfer from pre-trained models are also effective.

---

## Summary

| Concept | Key Point |
|---------|-----------|
| Perception-Planning-Action | Basic cycle of robot control |
| ROS 2 | Standard framework for robot software |
| Reinforcement Learning | Acquire motions through trial and error in simulation |
| Imitation Learning | Learn motions from human demonstrations |
| Diffusion Policy | Precise action generation based on diffusion models |
| Foundation Model | Control robots universally via language instructions |
| Sim-to-Real | Transfer technology from simulation to real robots |
| Inverse Kinematics | Calculate joint angles from target positions |
| Safety Filter | Safety constraints placed above AI control |
| Teleoperation | Demo data collection via remote operation |
| QDD Actuator | Low gear ratio motor for safe robots |

---

## Recommended Next Reads

- **02-emerging/02-smart-home.md** -- Smart Home: Matter, AI Appliances
- **02-emerging/00-ar-vr-ai.md** -- AR/VR x AI: Vision Pro, Quest
- **01-computing/02-edge-ai.md** -- Edge AI: NPU, Coral, Jetson

---

## References

1. **ROS 2 Official Documentation** https://docs.ros.org/en/rolling/
2. **Google DeepMind -- RT-2 Paper** https://robotics-transformer2.github.io/
3. **Boston Dynamics Official** https://bostondynamics.com/
4. **NVIDIA Isaac Sim** https://developer.nvidia.com/isaac-sim
5. **Diffusion Policy** https://diffusion-policy.cs.columbia.edu/
6. **Figure AI** https://figure.ai/
7. **Unitree Robotics** https://www.unitree.com/
