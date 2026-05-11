# Smart Home Guide

> A guide to building next-generation smart homes leveraging Matter, AI appliances, and voice assistants

## What You Will Learn

1. **Smart Home Protocols** — Differences and selection criteria for Matter, Thread, Zigbee, and Wi-Fi
2. **Evolution of AI Appliances** — Technical foundations of voice assistants, AI cameras, and predictive control
3. **Practical Implementation** — Designing and automating a smart home system centered on Home Assistant


## Prerequisites

Having the following knowledge will help deepen your understanding before reading this guide:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of the [Robotics Guide](./01-robotics.md)

---

## 1. Smart Home Overview

### Smart Home Layer Structure

```
+-----------------------------------------------------------+
|                  Smart Home Architecture                    |
+-----------------------------------------------------------+
|                                                           |
|  +----------------------------------------------------+  |
|  | Application Layer                                   |  |
|  | Apple Home / Google Home / Alexa / Home Assistant   |  |
|  | Automation rules, scenes, voice control             |  |
|  +----------------------------------------------------+  |
|                          |                                |
|  +----------------------------------------------------+  |
|  | Protocol Layer                                      |  |
|  | Matter / HomeKit / Google Home API / Alexa Skills   |  |
|  +----------------------------------------------------+  |
|                          |                                |
|  +----------------------------------------------------+  |
|  | Communication Layer                                 |  |
|  | Thread / Wi-Fi / Zigbee / Z-Wave / Bluetooth LE    |  |
|  +----------------------------------------------------+  |
|                          |                                |
|  +----------------------------------------------------+  |
|  | Device Layer                                        |  |
|  | Lighting / Thermostat / Camera / Door Lock / Sensor |  |
|  +----------------------------------------------------+  |
+-----------------------------------------------------------+
```

### Unification Through Matter

```
[Before Matter]                    [After Matter]

+--------+  +--------+  +------+  +----------------------------+
| HomeKit|  | Google |  | Alexa|  |         Matter             |
|  only  |  | only   |  | only |  |  (Apple + Google + Amazon  |
+--------+  +--------+  +------+  |   + Samsung + ...)         |
    |           |           |     +----------------------------+
    v           v           v              |
 Limited     Limited     Limited    Nearly all compatible devices
 devices     devices     devices    work across all platforms
```

### Smart Home Market Trends and Evolution

The smart home market has reached approximately $150 billion as of 2025, continuing to grow at an annual rate of over 20%. Three factors are driving this growth.

1. **Adoption of the Matter Standard**: Since the first version was released in 2022, the number of compatible devices has rapidly increased. As of late 2025, over 1,000 certified devices are available on the market.
2. **Advancement of Edge AI**: The decreasing cost of NPU-equipped devices has enabled local AI processing without cloud dependency.
3. **Rising Energy Prices**: Demand for AI-driven energy optimization has increased to reduce electricity costs.

```
[Four Stages of Smart Home Evolution]

Stage 1: Remote Control Replacement Era (2014-2018)
├── Simply controlling appliances from a smartphone
├── Standalone Wi-Fi-connected devices (Philips Hue, TP-Link)
└── Early voice assistants (Echo 1st Gen: 2014)

Stage 2: Automation Era (2018-2022)
├── IF-THEN rule-based automation (IFTTT, Alexa Routines)
├── Scene management ("Good Night" turns off all lights + locks doors)
└── Ecosystem lock-in competition

Stage 3: AI Integration Era (2022-2025)
├── Interoperability through Matter
├── LLM-based natural language control
├── Proactive automation through behavior prediction
└── Local AI processing (NPU, Coral)

Stage 4: Ambient AI Era (2025-)
├── Environment automatically adapts to occupants
├── Multimodal sensing (video + audio + environmental)
├── Simulation optimization through digital twins
└── Healthcare integration (sleep, stress, activity levels)
```

---

## 2. Communication Protocol Comparison

### Protocol Comparison Table

| Protocol | Frequency Band | Range | Power Consumption | Speed | Mesh | Primary Use |
|-----------|---------|---------|---------|------|---------|---------|
| Wi-Fi | 2.4/5/6 GHz | 30-50m | High | Fast | Not supported | Cameras, displays |
| Thread | 2.4 GHz | 10-30m | Very low | Medium | Supported | Sensors, lighting |
| Zigbee | 2.4 GHz | 10-20m | Very low | Slow | Supported | Sensors, switches |
| Z-Wave | 900 MHz | 30-100m | Low | Slow | Supported | Door locks, sensors |
| Bluetooth LE | 2.4 GHz | 10-30m | Very low | Slow | Supported (Mesh) | Short-range small devices |
| Matter | Upper layer of above | Protocol-dependent | Protocol-dependent | - | Via Thread | Unified standard |

### Thread Network Structure

```
+-----------------------------------------------------------+
|  Thread Mesh Network                                       |
+-----------------------------------------------------------+
|                                                           |
|  +------+            +------+            +------+         |
|  |Border|--- Wi-Fi --|Router|--- Wi-Fi --|Border|         |
|  |Router|            |      |            |Router|         |
|  +--+---+            +--+---+            +--+---+         |
|     |                   |                   |             |
|   Thread              Thread              Thread          |
|   mesh                mesh                mesh            |
|     |                   |                   |             |
|  +--+---+  +------+  +--+---+  +------+  +--+---+        |
|  | Light |--| Temp |--| Light |--| Door  |--| Temp |      |
|  |       |  |Sensor|  |       |  | Lock  |  |Sensor|      |
|  +------+  +------+  +------+  +------+  +------+        |
|                                                           |
|  Border Router: Bridge between Thread <-> Wi-Fi/Ethernet  |
|  (Apple TV, Google Nest Hub, HomePod mini are compatible) |
+-----------------------------------------------------------+
```

### Thread Protocol Technical Details

Thread is an IPv6-based mesh networking protocol built on IEEE 802.15.4. It uses the same physical layer as traditional Zigbee, but differs significantly from the network layer and above.

```
[Thread Protocol Stack]

+-------------------------------------------+
| Application Layer (Matter / CoAP)         |
+-------------------------------------------+
| UDP / TCP                                 |
+-------------------------------------------+
| IPv6 (6LoWPAN compression)                |
+-------------------------------------------+
| Mesh Link Establishment (MLE)             |
| Routing: RLOC16-based                     |
+-------------------------------------------+
| IEEE 802.15.4 MAC                          |
| AES-CCM-128 encryption                    |
+-------------------------------------------+
| IEEE 802.15.4 PHY                          |
| 2.4 GHz, 250 kbps                         |
+-------------------------------------------+
```

Thread network nodes have the following roles.

| Node Type | Role | Always On | Relay Capability |
|-------------|------|---------|---------|
| Leader | Network management, partition merging | Yes | Yes |
| Router | Packet relay, child node management | Yes | Yes |
| REED (Router-Eligible End Device) | Promotes to Router when needed | Yes | After promotion |
| End Device (SED/MED) | End device, no relay | MED: Yes / SED: Intermittent | None |
| Border Router | Thread <-> Wi-Fi/Ethernet bridge | Yes | Yes |

```python
# Example of retrieving Thread network information using OpenThread
import openthread

def analyze_thread_network(interface="wpan0"):
    """Analyze the state of a Thread network"""
    ot = openthread.OpenThread(interface)

    # Network information
    network_info = {
        "network_name": ot.get_network_name(),
        "channel": ot.get_channel(),
        "panid": hex(ot.get_panid()),
        "extended_panid": ot.get_extended_panid().hex(),
        "mesh_local_prefix": str(ot.get_mesh_local_prefix()),
    }

    # Node information
    node_info = {
        "role": ot.get_role(),  # leader, router, child, detached
        "rloc16": hex(ot.get_rloc16()),
        "router_id": ot.get_router_id(),
        "partition_id": ot.get_partition_id(),
    }

    # Neighbor node list
    neighbors = ot.get_neighbor_table()
    for neighbor in neighbors:
        print(f"  Neighbor RLOC16: {hex(neighbor.rloc16)}")
        print(f"    Role: {'Router' if neighbor.is_router else 'Child'}")
        print(f"    Link Quality: {neighbor.link_quality_in}/3")
        print(f"    Age: {neighbor.age}s")
        print(f"    RSSI: {neighbor.average_rssi} dBm")

    # Routing table
    router_table = ot.get_router_table()
    print(f"\nRouter Table ({len(router_table)} entries):")
    for router in router_table:
        print(f"  Router ID {router.router_id}: "
              f"RLOC16={hex(router.rloc16)}, "
              f"Next Hop={router.next_hop}, "
              f"Path Cost={router.path_cost}")

    return network_info, node_info
```

### Zigbee to Thread Migration Strategy

For users who own existing Zigbee devices, migrating to Thread is an important consideration.

```
[Zigbee -> Thread Migration Paths]

Pattern A: Via Bridge (Recommended)
+-------------------+     +------------------+     +--------+
| Zigbee device     | --> | Zigbee-Matter    | --> | Matter |
| group             |     | Bridge           |     | unified|
| (Hue, IKEA, etc.) |     | (Hue Bridge v2)  |     +--------+
+-------------------+     +------------------+

Pattern B: Gradual Replacement
Phase 1: New purchases are Thread/Matter compatible only
Phase 2: Replace with Thread devices when broken or end-of-life
Phase 3: Complete migration in 3-5 years

Pattern C: Coexistence (Cost-focused)
+-------------------+     +------------------+
| Zigbee devices    | --> | Zigbee2MQTT      | --> Home Assistant
+-------------------+     +------------------+         ^
+-------------------+     +------------------+         |
| Thread devices    | --> | Thread Border    | --------+
+-------------------+     | Router           |
                          +------------------+
```

---

## 3. Matter Protocol

### Matter Technical Structure

```
+-----------------------------------------------------------+
|                    Matter Protocol                          |
+-----------------------------------------------------------+
|                                                           |
|  +----------------------------------------------------+  |
|  | Application Layer                                   |  |
|  | Device type definitions (lighting, thermostat,      |  |
|  | door lock)                                          |  |
|  | Clusters (On/Off, Level Control, Color Control)     |  |
|  +----------------------------------------------------+  |
|                                                           |
|  +----------------------------------------------------+  |
|  | Interaction Model                                   |  |
|  | Read / Write / Subscribe / Invoke                   |  |
|  +----------------------------------------------------+  |
|                                                           |
|  +----------------------------------------------------+  |
|  | Security Layer                                      |  |
|  | CASE (Certificate Authenticated Session)             |  |
|  | PASE (Passcode Authenticated Session)                |  |
|  +----------------------------------------------------+  |
|                                                           |
|  +----------------------------------------------------+  |
|  | Transport Layer                                     |  |
|  | IPv6 over Wi-Fi / Thread / Ethernet                 |  |
|  +----------------------------------------------------+  |
+-----------------------------------------------------------+
```

### Matter Device Types and Clusters

Matter standardizes device capabilities in units called "clusters." Each device type is defined by a combination of required clusters and optional clusters.

| Device Type | Device Type ID | Required Clusters | Optional Clusters |
|--------------|---------------|-------------|-------------------|
| On/Off Light | 0x0100 | On/Off, Level Control | Color Control, Scenes |
| Dimmable Light | 0x0101 | On/Off, Level Control | Color Control |
| Color Temperature Light | 0x010C | On/Off, Level, Color Control | Scenes |
| Thermostat | 0x0301 | Thermostat, Fan Control | Humidity Measurement |
| Door Lock | 0x000A | Door Lock | Alarms, Time Sync |
| Window Covering | 0x0202 | Window Covering | Scenes |
| Occupancy Sensor | 0x0107 | Occupancy Sensing | Illuminance |
| Temperature Sensor | 0x0302 | Temperature Measurement | - |
| Humidity Sensor | 0x0307 | Relative Humidity | - |
| Contact Sensor | 0x0015 | Boolean State | - |

### Matter Commissioning (Pairing) Process

```
[Matter Device Commissioning Flow]

1. QR Code Scan / NFC Touch
   +---------------+     +----------------+
   | Smartphone    | --> | Device QR Code |
   | (Commissioner)|     | (Commissionee) |
   +---------------+     +----------------+

2. PASE (Passcode Authenticated Session Establishment)
   Commissioner <---- SPAKE2+ ----> Commissionee
   * Extract setup payload from QR code
   * Authenticate with Discriminator + Passcode

3. Certificate Chain Verification
   Commissionee -> DAC (Device Attestation Certificate)
                -> PAI (Product Attestation Intermediate)
                -> PAA (Product Attestation Authority)
   * Verify via DCL (Distributed Compliance Ledger)

4. NOC (Network Operating Certificate) Issuance
   Commissioner -> Root CA -> NOC -> Commissionee
   * Assign Fabric ID + Node ID

5. ACL (Access Control List) Configuration
   Admin can grant access rights to other controllers
   * Multi-Admin: Can join up to 5 Fabrics simultaneously

6. CASE Session Establishment (Operational)
   Controller <-- Sigma1/Sigma2/Sigma3 --> Device
   * Mutual authentication based on NOC
   * AES-CCM-128 encrypted communication
```

### Code Example 1: Controlling Matter Devices (Conceptual Code)

```python
# Matter device control example (Python chip-tool-like API)
from matter_sdk import MatterController, clusters

async def control_smart_home():
    controller = MatterController()

    # Device discovery and pairing
    devices = await controller.discover()
    print(f"Discovered devices: {len(devices)}")

    for device in devices:
        print(f"  - {device.name} (Type: {device.device_type})")

    # Lighting control
    light = controller.get_device("living_room_light")

    # On/Off cluster
    await light.clusters.on_off.on()

    # Level Control cluster (brightness)
    await light.clusters.level_control.move_to_level(
        level=128,           # 0-254 (50%)
        transition_time=10,  # 1 second (10 = 1s)
    )

    # Color Control cluster (color temperature)
    await light.clusters.color_control.move_to_color_temperature(
        color_temperature_mireds=370,  # 2700K (warm white)
        transition_time=20,
    )

    # Thermostat control
    thermostat = controller.get_device("thermostat")
    await thermostat.clusters.thermostat.set_setpoint(
        mode="heating",
        temperature=22.0,  # Celsius
    )

    # Door lock control
    lock = controller.get_device("front_door")
    await lock.clusters.door_lock.lock()
    status = await lock.clusters.door_lock.get_lock_state()
    print(f"Door status: {status}")  # "locked"
```

### Code Example: Matter Device Development (ESP32 + ESP-Matter)

```cpp
// Example of developing a Matter-compatible lighting device with ESP32
// ESP-IDF + ESP-Matter SDK

#include <esp_matter.h>
#include <esp_matter_attribute.h>
#include <esp_matter_endpoint.h>
#include <app/server/Server.h>

using namespace esp_matter;
using namespace chip::app::Clusters;

// GPIO configuration
#define LED_GPIO GPIO_NUM_2

// Attribute callback
static esp_err_t app_attribute_update_cb(
    attribute::callback_type_t type,
    uint16_t endpoint_id,
    uint32_t cluster_id,
    uint32_t attribute_id,
    esp_matter_attr_val_t *val,
    void *priv_data)
{
    if (type == attribute::PRE_UPDATE) {
        // On/Off cluster handling
        if (cluster_id == OnOff::Id) {
            if (attribute_id == OnOff::Attributes::OnOff::Id) {
                gpio_set_level(LED_GPIO, val->val.b ? 1 : 0);
                ESP_LOGI("APP", "LED %s", val->val.b ? "ON" : "OFF");
            }
        }
        // Level Control cluster handling
        if (cluster_id == LevelControl::Id) {
            if (attribute_id == LevelControl::Attributes::CurrentLevel::Id) {
                uint8_t level = val->val.u8;
                // Brightness control via PWM (0-254 -> 0-255 duty)
                ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, level);
                ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
                ESP_LOGI("APP", "Brightness: %d/254", level);
            }
        }
    }
    return ESP_OK;
}

extern "C" void app_main()
{
    // GPIO initialization
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << LED_GPIO),
        .mode = GPIO_MODE_OUTPUT,
    };
    gpio_config(&io_conf);

    // Create Matter node
    node::config_t node_config;
    node_t *node = node::create(&node_config, app_attribute_update_cb, NULL);

    // Add Dimmable Light endpoint
    endpoint::dimmable_light::config_t light_config;
    light_config.on_off.on_off = false;
    light_config.level_control.current_level = 128;
    endpoint_t *endpoint = endpoint::dimmable_light::create(
        node, &light_config, ENDPOINT_FLAG_NONE, NULL
    );

    // Start Matter
    esp_matter::start(NULL);

    ESP_LOGI("APP", "Matter Dimmable Light Started");
    ESP_LOGI("APP", "QR Code URL: https://project-chip.github.io/...");
}
```

### Code Example 2: Home Assistant Automation Configuration

```yaml
# Home Assistant automation.yaml
# Automation rules with AI-like conditional logic

# Automation 1: Auto-turn on lights at sunset
- alias: "Sunset lighting automation"
  trigger:
    - platform: sun
      event: sunset
      offset: "-00:30:00"  # 30 minutes before sunset
  condition:
    - condition: state
      entity_id: binary_sensor.occupancy_living_room
      state: "on"  # Only when someone is home
  action:
    - service: light.turn_on
      target:
        entity_id: light.living_room
      data:
        brightness_pct: 70
        color_temp_kelvin: 3000
        transition: 30  # Fade in over 30 seconds

# Automation 2: Energy-saving mode on departure detection
- alias: "Energy-saving mode when everyone is away"
  trigger:
    - platform: state
      entity_id: group.family
      to: "not_home"
      for: "00:10:00"  # Absent for 10 minutes
  action:
    - service: climate.set_temperature
      target:
        entity_id: climate.main_thermostat
      data:
        temperature: 18  # Lower heating
    - service: light.turn_off
      target:
        entity_id: all
    - service: switch.turn_off
      target:
        entity_id: switch.entertainment_system

# Automation 3: AI camera integration (person detection)
- alias: "Suspicious person detection alert"
  trigger:
    - platform: state
      entity_id: image_processing.front_camera_person_detection
      to: "detected"
  condition:
    - condition: state
      entity_id: group.family
      state: "not_home"
  action:
    - service: notify.mobile_app
      data:
        title: "Security Alert"
        message: "Person detected on the front door camera"
        data:
          image: "/api/camera_proxy/camera.front_door"
    - service: light.turn_on
      target:
        entity_id: light.porch
      data:
        brightness_pct: 100
```

### Code Example: Home Assistant Custom Component Development

```python
"""Home Assistant custom integration: Smart environment sensor"""
# custom_components/smart_environment/sensor.py

import logging
from datetime import timedelta
from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorStateClass,
)
from homeassistant.const import UnitOfTemperature, PERCENTAGE
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
)

_LOGGER = logging.getLogger(__name__)
SCAN_INTERVAL = timedelta(seconds=30)

class SmartEnvironmentCoordinator(DataUpdateCoordinator):
    """Coordinator for unified management of environmental data"""

    def __init__(self, hass, sensors_config):
        super().__init__(
            hass,
            _LOGGER,
            name="Smart Environment",
            update_interval=SCAN_INTERVAL,
        )
        self._sensors = sensors_config
        self._history = []

    async def _async_update_data(self):
        """Collect and analyze sensor data"""
        data = {}

        # Collect data from each sensor
        for sensor_id in self._sensors:
            state = self.hass.states.get(sensor_id)
            if state and state.state not in ("unknown", "unavailable"):
                data[sensor_id] = float(state.state)

        # Calculate comfort score
        if "sensor.temperature" in data and "sensor.humidity" in data:
            temp = data["sensor.temperature"]
            humidity = data["sensor.humidity"]
            data["comfort_score"] = self._calculate_comfort(temp, humidity)

        # Ventilation recommendation
        if "sensor.co2" in data:
            co2 = data["sensor.co2"]
            data["ventilation_needed"] = co2 > 1000

        # Save history (for trend analysis)
        self._history.append(data)
        if len(self._history) > 120:  # 1 hour worth
            self._history.pop(0)

        # Trend analysis
        data["temperature_trend"] = self._analyze_trend("sensor.temperature")

        return data

    def _calculate_comfort(self, temp, humidity):
        """Comfort calculation using simplified PMV model (0-100)"""
        # Simplified calculation based on discomfort index
        discomfort = 0.81 * temp + 0.01 * humidity * (
            0.99 * temp - 14.3
        ) + 46.3
        # 70-75 is the comfort zone
        if 70 <= discomfort <= 75:
            return 100
        elif discomfort < 70:
            return max(0, 100 - (70 - discomfort) * 10)
        else:
            return max(0, 100 - (discomfort - 75) * 10)

    def _analyze_trend(self, sensor_id):
        """Analyze trends over the last 30 minutes"""
        values = [
            h.get(sensor_id) for h in self._history[-60:]
            if h.get(sensor_id) is not None
        ]
        if len(values) < 10:
            return "stable"
        slope = (values[-1] - values[0]) / len(values)
        if slope > 0.05:
            return "rising"
        elif slope < -0.05:
            return "falling"
        return "stable"


class ComfortScoreSensor(CoordinatorEntity, SensorEntity):
    """Comfort score sensor"""

    _attr_name = "Comfort Score"
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:emoticon-happy-outline"

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = "smart_env_comfort_score"

    @property
    def native_value(self):
        if self.coordinator.data:
            return self.coordinator.data.get("comfort_score")
        return None

    @property
    def extra_state_attributes(self):
        """Additional attributes"""
        data = self.coordinator.data or {}
        return {
            "temperature_trend": data.get("temperature_trend", "unknown"),
            "ventilation_needed": data.get("ventilation_needed", False),
        }
```

### Home Assistant Dashboard (Lovelace UI) Design

```yaml
# Home Assistant Lovelace Dashboard design example
# ui-lovelace.yaml

title: Smart Home
views:
  - title: Home
    path: home
    icon: mdi:home
    cards:
      # Occupancy status card
      - type: entities
        title: Family Occupancy Status
        entities:
          - entity: person.taro
            secondary_info: last-changed
          - entity: person.hanako
            secondary_info: last-changed
          - entity: binary_sensor.anyone_home
            name: Someone Home

      # Environment monitor
      - type: custom:mini-graph-card
        title: Indoor Environment
        entities:
          - entity: sensor.living_room_temperature
            name: Temperature
            color: "#e74c3c"
          - entity: sensor.living_room_humidity
            name: Humidity
            color: "#3498db"
            y_axis: secondary
        hours_to_show: 24
        points_per_hour: 4
        show:
          labels: true
          average: true
          extrema: true

      # Lighting control
      - type: custom:light-entity-card
        entity: light.living_room
        shorten_cards: true
        consolidate_entities: true
        child_card: true
        hide_header: false
        effects_list: true

      # Energy consumption
      - type: energy-distribution
        title: Energy Distribution
        link_dashboard: true

      # Camera feed
      - type: picture-glance
        title: Front Door Camera
        camera_image: camera.front_door
        entities:
          - binary_sensor.front_door_motion
          - binary_sensor.front_door_person
        camera_view: live

  - title: Automations
    path: automations
    icon: mdi:robot
    cards:
      # Automation list and status
      - type: custom:auto-entities
        card:
          type: entities
          title: Active Automations
        filter:
          include:
            - domain: automation
              state: "on"
          exclude:
            - entity_id: automation.system_*
        sort:
          method: last_triggered
          reverse: true

      # Automation trigger history
      - type: logbook
        title: Recent Automation Executions
        hours_to_show: 24
        entities:
          - automation.sunset_lights
          - automation.away_mode
          - automation.security_alert
```

---

## 4. Voice Assistants and AI

### Voice Assistant Comparison Table

| Item | Amazon Alexa | Google Assistant | Apple Siri | Home Assistant Voice |
|------|-------------|-----------------|------------|---------------------|
| Devices | Echo series | Nest series | HomePod, iPhone | DIY/ESP32 |
| Smart home integration | Very broad | Broad | HomeKit-centric | Broadest (DIY) |
| AI capability | Alexa LLM | Gemini integration | Apple Intelligence | Local LLM support |
| Privacy | Cloud processing | Cloud processing | On-device focus | Fully local possible |
| Skills/Actions | 100,000+ | Tens of thousands | Siri Shortcuts | All Home Assistant features |
| Japanese support | Supported | Supported | Supported | Community support |
| Price range | $20-200 | $30-200 | $100-350 | DIY cost |

### Voice Recognition Pipeline

```
+-----------------------------------------------------------+
|  Voice Assistant Processing Flow                           |
+-----------------------------------------------------------+
|                                                           |
|  "Alexa, set the living room lights to warm"              |
|      |                                                    |
|      v                                                    |
|  +--------------------+                                   |
|  | Wake Word Detection |  <- Runs constantly on device    |
|  | Detects "Alexa"     |     (NPU)                       |
|  +--------------------+                                   |
|      |                                                    |
|      v                                                    |
|  +--------------------+                                   |
|  | Speech Recognition  |  <- Cloud or on-device           |
|  | (ASR)               |     Whisper, Google ASR          |
|  | Speech -> Text      |                                  |
|  +--------------------+                                   |
|      |                                                    |
|      v                                                    |
|  +--------------------+                                   |
|  | Natural Language    |  <- LLM-based is now mainstream  |
|  | Understanding (NLU) |     Intent and entity extraction |
|  | Intent: Light ctrl  |                                  |
|  | Entity: Living room |                                  |
|  | Entity: Warm        |                                  |
|  +--------------------+                                   |
|      |                                                    |
|      v                                                    |
|  +--------------------+                                   |
|  | Skill/Action        |  <- Device API call              |
|  | light.set_color()  |                                   |
|  +--------------------+                                   |
|      |                                                    |
|      v                                                    |
|  +--------------------+                                   |
|  | Text-to-Speech      |  <- Generate confirmation        |
|  | (TTS)               |     response                     |
|  | "The living room    |                                  |
|  |  lights have been   |                                  |
|  |  set to warm"       |                                  |
|  +--------------------+                                   |
+-----------------------------------------------------------+
```

### Building a Local Voice Assistant (Wyoming Protocol)

Home Assistant's local voice processing uses the Wyoming protocol to connect each voice processing component as a microservice.

```
[Local Voice Assistant Architecture]

+-------------------+
| Microphone Input  |  ESP32-S3-BOX / USB Microphone
+--------+----------+
         |
         v
+--------+----------+
| Wake Word Detection|  openWakeWord / Porcupine
| "OK Nabu"          |  <- Runs on ESP32 (low latency)
+--------+----------+
         |
         v (Wyoming Protocol)
+--------+----------+
| Speech-to-Text     |  faster-whisper / Whisper.cpp
| (STT)              |  <- Local GPU or CPU
| Speech -> Text     |
| Model: large-v3    |  <- Japanese supported
+--------+----------+
         |
         v
+--------+----------+
| Intent Processing  |  Home Assistant Conversation Agent
| LLM or rule-based  |  <- Ollama (llama3) / Rule-based
+--------+----------+
         |
         v
+--------+----------+
| Text-to-Speech     |  Piper TTS
| (TTS)              |  <- Local, low latency
| Text -> Speech     |
| Voice: ja_JP-takumi|  <- Japanese voice model
+--------+----------+
         |
         v
+--------+----------+
| Speaker Output     |  ESP32-S3-BOX / External Speaker
+-------------------+
```

```yaml
# Home Assistant Wyoming voice pipeline configuration
# docker-compose.yml

version: '3.8'
services:
  # Whisper STT server
  whisper:
    image: rhasspy/wyoming-whisper:latest
    ports:
      - "10300:10300"
    volumes:
      - whisper-data:/data
    command: >
      --model large-v3
      --language ja
      --device cuda  # Use GPU (CPU: --device cpu)
      --beam-size 5
      --compute-type float16
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # Piper TTS server
  piper:
    image: rhasspy/wyoming-piper:latest
    ports:
      - "10200:10200"
    volumes:
      - piper-data:/data
    command: >
      --voice ja_JP-takumi-medium
      --speaker 0
      --length-scale 1.0
      --noise-scale 0.667
      --noise-w 0.8

  # openWakeWord server
  openwakeword:
    image: rhasspy/wyoming-openwakeword:latest
    ports:
      - "10400:10400"
    command: >
      --preload-model ok_nabu
      --threshold 0.5
      --trigger-level 1

volumes:
  whisper-data:
  piper-data:
```

### Building an ESP32-S3-Based Voice Satellite

```yaml
# ESPHome configuration: Convert ESP32-S3-BOX into a voice satellite
# esphome/voice-satellite.yaml

esphome:
  name: voice-satellite-living
  friendly_name: "Living Room Voice Assistant"

esp32:
  board: esp32-s3-box
  framework:
    type: esp-idf

# Wi-Fi configuration
wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password

# Microphone (I2S input)
i2s_audio:
  - id: i2s_input
    i2s_lrclk_pin: GPIO41
    i2s_bclk_pin: GPIO42
  - id: i2s_output
    i2s_lrclk_pin: GPIO46
    i2s_bclk_pin: GPIO17

microphone:
  - platform: i2s_audio
    id: mic
    i2s_audio_id: i2s_input
    adc_type: external
    i2s_din_pin: GPIO2
    pdm: false
    channel: left
    bits_per_sample: 32bit
    sample_rate: 16000

# Speaker (I2S output)
speaker:
  - platform: i2s_audio
    id: spk
    i2s_audio_id: i2s_output
    dac_type: external
    i2s_dout_pin: GPIO15
    mode: stereo

# Voice assistant
voice_assistant:
  id: va
  microphone: mic
  speaker: spk
  noise_suppression_level: 2
  auto_gain: 31dBFS
  volume_multiplier: 2.0
  use_wake_word: true
  on_wake_word_detected:
    - light.turn_on:
        id: led_ring
        effect: "listening"
  on_stt_end:
    - light.turn_on:
        id: led_ring
        effect: "thinking"
  on_tts_start:
    - light.turn_on:
        id: led_ring
        effect: "speaking"
  on_end:
    - light.turn_off:
        id: led_ring
    - wait_until:
        not:
          voice_assistant.is_running:
    - delay: 500ms
    - voice_assistant.start_continuous:

# LED ring (status indicator)
light:
  - platform: esp32_rmt_led_strip
    id: led_ring
    pin: GPIO39
    num_leds: 12
    chipset: SK6812
    rgb_order: GRB
    effects:
      - addressable_rainbow:
          name: "listening"
          speed: 30
      - pulse:
          name: "thinking"
          min_brightness: 30%
          max_brightness: 100%
      - addressable_scan:
          name: "speaking"
          move_interval: 50ms

# Physical button (mute)
binary_sensor:
  - platform: gpio
    pin:
      number: GPIO0
      inverted: true
    name: "Mute Button"
    on_press:
      - voice_assistant.stop:
      - light.turn_on:
          id: led_ring
          red: 100%
          green: 0%
          blue: 0%
```

---

## 5. AI Appliance Technology

### Code Example 3: Energy Optimization AI

```python
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

class SmartThermostatAI:
    """
    AI-driven predictive control for thermostats.
    Predicts optimal temperature based on user behavior patterns
    and outdoor temperature.
    """
    def __init__(self):
        self.comfort_model = GradientBoostingRegressor()
        self.occupancy_model = GradientBoostingRegressor()

    def train(self, history_data):
        """Train from historical behavior data"""
        features = self._extract_features(history_data)
        # Features: time, day of week, outdoor temp, humidity,
        #           previous temperature settings
        # Target: temperature set by user

        self.comfort_model.fit(
            features, history_data['target_temperature']
        )
        self.occupancy_model.fit(
            features, history_data['is_occupied']
        )

    def predict_schedule(self, forecast_weather, day_of_week):
        """Predict 24-hour temperature schedule"""
        schedule = []
        for hour in range(24):
            features = np.array([[
                hour,
                day_of_week,
                forecast_weather[hour]['temperature'],
                forecast_weather[hour]['humidity'],
            ]])

            predicted_temp = self.comfort_model.predict(features)[0]
            occupancy_prob = self.occupancy_model.predict(features)[0]

            # Switch to energy-saving temperature when absence is predicted
            if occupancy_prob < 0.3:
                target_temp = predicted_temp - 3  # Lower by 3 degrees
            else:
                target_temp = predicted_temp

            schedule.append({
                'hour': hour,
                'target': round(target_temp, 1),
                'occupancy': round(occupancy_prob, 2),
            })

        return schedule

    def estimate_energy_savings(self, schedule, baseline=22.0):
        """Estimate energy savings"""
        # Approximately 7% savings per degree lowered
        savings = sum(
            max(0, baseline - s['target']) * 0.07
            for s in schedule
        ) / 24
        return f"Estimated energy savings: {savings*100:.1f}%"
```

### Code Example: Advanced Home Energy Management System (HEMS)

```python
"""Home Energy Management System (HEMS) implementation"""
import asyncio
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional

@dataclass
class EnergyDevice:
    """Energy device abstraction"""
    name: str
    entity_id: str
    power_watts: float
    priority: int  # 1=highest, 5=lowest
    shiftable: bool  # Whether operating time can be shifted
    min_runtime_minutes: int = 0
    max_power_watts: Optional[float] = None

class HEMSController:
    """
    HEMS (Home Energy Management System) Controller

    Optimizes appliance operating schedules considering
    solar power generation, battery storage, and electricity rates.
    """

    def __init__(self, hass, config):
        self.hass = hass
        self.config = config
        self.devices: list[EnergyDevice] = []
        self.solar_forecast = []
        self.price_schedule = []
        self.battery_soc = 0.0  # State of Charge (%)

    async def update_solar_forecast(self):
        """Update solar power generation forecast (Solcast API)"""
        import aiohttp
        async with aiohttp.ClientSession() as session:
            url = "https://api.solcast.com.au/rooftop_sites"
            params = {
                "resource_id": self.config["solcast_resource_id"],
                "api_key": self.config["solcast_api_key"],
            }
            async with session.get(
                f"{url}/{params['resource_id']}/forecasts",
                params={"api_key": params["api_key"]}
            ) as resp:
                data = await resp.json()

        self.solar_forecast = [
            {
                "time": entry["period_end"],
                "power_kw": entry["pv_estimate"],
                "power_kw_10": entry["pv_estimate10"],  # 10th percentile
                "power_kw_90": entry["pv_estimate90"],  # 90th percentile
            }
            for entry in data["forecasts"][:48]  # 24 hours worth
        ]

    def get_electricity_price(self, hour: int) -> float:
        """Get time-of-use electricity rate (JPY/kWh)"""
        # Assuming dynamic pricing plan like Octopus Energy
        price_table = {
            range(0, 6): 18.0,    # Late-night rate
            range(6, 8): 28.0,    # Early morning
            range(8, 10): 32.0,   # Morning
            range(10, 17): 35.0,  # Daytime peak
            range(17, 21): 38.0,  # Evening peak
            range(21, 24): 25.0,  # Nighttime
        }
        for time_range, price in price_table.items():
            if hour in time_range:
                return price
        return 30.0

    async def optimize_schedule(self):
        """Optimize device operating schedule"""
        schedule = {}
        current_hour = datetime.now().hour

        for device in sorted(self.devices, key=lambda d: d.priority):
            if not device.shiftable:
                # Non-shiftable devices remain as-is
                schedule[device.entity_id] = "always_on"
                continue

            # Search for the cheapest time slot
            best_hour = current_hour
            best_cost = float('inf')
            runtime_hours = max(1, device.min_runtime_minutes // 60)

            for start_hour in range(24):
                total_cost = 0
                for h in range(runtime_hours):
                    hour = (start_hour + h) % 24
                    price = self.get_electricity_price(hour)

                    # Reduce cost during solar generation hours
                    solar_offset = self._get_solar_power(hour)
                    net_price = price * max(
                        0, 1 - solar_offset / device.power_watts
                    )
                    total_cost += net_price * (device.power_watts / 1000)

                if total_cost < best_cost:
                    best_cost = total_cost
                    best_hour = start_hour

            schedule[device.entity_id] = {
                "start_hour": best_hour,
                "duration_hours": runtime_hours,
                "estimated_cost_yen": round(best_cost, 1),
            }

        return schedule

    def _get_solar_power(self, hour: int) -> float:
        """Get solar power generation (W) for specified hour"""
        for forecast in self.solar_forecast:
            forecast_hour = datetime.fromisoformat(
                forecast["time"]
            ).hour
            if forecast_hour == hour:
                return forecast["power_kw"] * 1000
        return 0

    async def battery_strategy(self):
        """Determine battery charge/discharge strategy"""
        strategies = []
        for hour in range(24):
            price = self.get_electricity_price(hour)
            solar = self._get_solar_power(hour)

            if solar > 2000 and self.battery_soc < 80:
                # Charge from surplus solar
                strategies.append({
                    "hour": hour, "action": "charge",
                    "reason": "Solar surplus", "power_w": min(solar - 1500, 3000)
                })
            elif price >= 35 and self.battery_soc > 30:
                # Discharge during high-rate periods
                strategies.append({
                    "hour": hour, "action": "discharge",
                    "reason": "Peak rate avoidance", "power_w": 2000
                })
            elif price <= 20 and self.battery_soc < 50:
                # Charge during late-night rates
                strategies.append({
                    "hour": hour, "action": "charge",
                    "reason": "Late-night rate charging", "power_w": 3000
                })
            else:
                strategies.append({
                    "hour": hour, "action": "standby",
                    "reason": "Standby", "power_w": 0
                })

        return strategies

    def daily_report(self, schedule, battery_plan):
        """Generate daily energy report"""
        total_cost = sum(
            s.get("estimated_cost_yen", 0)
            for s in schedule.values()
            if isinstance(s, dict)
        )
        solar_total = sum(
            self._get_solar_power(h) / 1000 for h in range(24)
        )
        charge_hours = sum(
            1 for s in battery_plan if s["action"] == "charge"
        )
        discharge_hours = sum(
            1 for s in battery_plan if s["action"] == "discharge"
        )

        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "estimated_cost_yen": round(total_cost, 0),
            "solar_generation_kwh": round(solar_total, 1),
            "battery_charge_hours": charge_hours,
            "battery_discharge_hours": discharge_hours,
            "self_consumption_rate": round(
                solar_total / max(1, solar_total + total_cost / 30) * 100, 1
            ),
        }
```

### Code Example 4: AI Camera Person Detection

```python
# Local AI camera (Frigate NVR + Home Assistant integration)
# frigate.yml configuration example

# Frigate NVR configuration
mqtt:
  host: 192.168.1.100

detectors:
  coral:
    type: edgetpu
    device: usb  # Google Coral USB Accelerator

cameras:
  front_door:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.1.50:554/stream
          roles:
            - detect
            - record
    detect:
      width: 1280
      height: 720
      fps: 5
    objects:
      track:
        - person
        - car
        - dog
      filters:
        person:
          min_area: 5000
          max_area: 100000
          threshold: 0.7
    zones:
      front_yard:
        coordinates: 0,300,640,300,640,720,0,720
    record:
      enabled: true
      retain:
        days: 7
      events:
        retain:
          default: 30  # Retain event footage for 30 days
    snapshots:
      enabled: true
      retain:
        default: 30
```

### Advanced Frigate NVR Configuration and Optimization

```yaml
# frigate.yml - Advanced configuration
# Multiple cameras + custom models + notification settings

# Global settings
mqtt:
  host: 192.168.1.100
  port: 1883
  user: frigate
  password: "{FRIGATE_MQTT_PASSWORD}"
  topic_prefix: frigate

database:
  path: /media/frigate/frigate.db

# Detector configuration (multiple supported)
detectors:
  coral_usb:
    type: edgetpu
    device: usb:0
  # Second Coral (for high-load environments)
  coral_pcie:
    type: edgetpu
    device: pci:0

# Model configuration
model:
  path: /config/model_cache/yolov8n_320.tflite
  input_tensor: nhwc
  input_pixel_format: rgb
  width: 320
  height: 320
  labelmap_path: /config/labelmap.txt

# Recording settings
record:
  enabled: true
  retain:
    days: 7
    mode: motion  # motion/all
  events:
    retain:
      default: 30
      mode: active_objects
    pre_capture: 5   # 5 seconds before event
    post_capture: 10  # 10 seconds after event

# Snapshot settings
snapshots:
  enabled: true
  timestamp: true
  bounding_box: true
  crop: true
  quality: 85
  retain:
    default: 30

# Multiple camera configuration
cameras:
  # Front door camera
  front_door:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.1.50:554/h264
          roles: [detect]
        - path: rtsp://192.168.1.50:554/h265_main
          roles: [record]
      output_args:
        record: -f segment -segment_time 60 -segment_format mp4 -reset_timestamps 1 -strftime 1 -c:v copy -c:a aac
    detect:
      width: 1280
      height: 720
      fps: 5
      enabled: true
    motion:
      threshold: 25
      contour_area: 30
      delta_alpha: 0.2
      frame_alpha: 0.2
      improve_contrast: true
    objects:
      track: [person, car, dog, cat, package]
      filters:
        person:
          min_area: 5000
          min_score: 0.6
          threshold: 0.75
        car:
          min_area: 10000
          min_score: 0.5
        package:
          min_area: 2000
          min_score: 0.5
    zones:
      porch:
        coordinates: 100,400,500,400,500,720,100,720
        objects: [person, package]
      driveway:
        coordinates: 500,300,1280,300,1280,720,500,720
        objects: [person, car]
    review:
      alerts:
        required_zones: [porch]
        labels: [person]
      detections:
        labels: [car, dog, cat]

  # Backyard camera
  backyard:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.1.51:554/stream
          roles: [detect, record]
    detect:
      width: 1920
      height: 1080
      fps: 5
    objects:
      track: [person, dog, cat]
      filters:
        person:
          min_area: 3000
          threshold: 0.7
    motion:
      mask:
        # Exclude tree sway
        - 0,0,200,0,200,300,0,300

  # Indoor camera (pet monitor)
  living_room:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.1.52:554/stream
          roles: [detect]
    detect:
      width: 640
      height: 480
      fps: 3  # Low FPS is sufficient for indoors
    objects:
      track: [dog, cat]
      filters:
        dog:
          min_area: 2000
    record:
      enabled: false  # No recording for privacy reasons
    snapshots:
      enabled: true

# Notification settings (Home Assistant integration)
# Configure on the automation.yaml side
```

### Code Example 5: Local LLM Integration with Home Assistant

```yaml
# Home Assistant configuration.yaml
# Integration with local LLM (Ollama)

# Ollama voice assistant integration
conversation:
  intents:
    # Custom intent definitions

# Extended OpenAI Conversation (custom component)
# Sends requests to local Ollama
openai_conversation:
  api_key: "sk-not-needed"
  base_url: "http://192.168.1.100:11434/v1"
  model: "llama3.1"
  prompt: |
    You are a smart home assistant.
    You can control the following devices:
    - light.living_room: Living room light
    - light.bedroom: Bedroom light
    - climate.thermostat: Air conditioner
    - lock.front_door: Front door lock
    - cover.curtain_living: Living room curtain

    Generate appropriate service calls based on the user's requests.
    Respond in the user's language.
```

### LLM-Based Smart Home Control (Function Calling)

```python
"""Smart home control via LLM Function Calling"""
import json
from openai import OpenAI

# Connect to local Ollama
client = OpenAI(
    base_url="http://192.168.1.100:11434/v1",
    api_key="not-needed",
)

# Define Home Assistant services as functions
tools = [
    {
        "type": "function",
        "function": {
            "name": "control_light",
            "description": "Control lighting (turn on/off, adjust brightness/color temperature)",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "Entity ID of the light",
                        "enum": [
                            "light.living_room",
                            "light.bedroom",
                            "light.kitchen",
                            "light.bathroom",
                        ],
                    },
                    "action": {
                        "type": "string",
                        "enum": ["turn_on", "turn_off", "toggle"],
                    },
                    "brightness_pct": {
                        "type": "integer",
                        "description": "Brightness (0-100%)",
                        "minimum": 0,
                        "maximum": 100,
                    },
                    "color_temp_kelvin": {
                        "type": "integer",
                        "description": "Color temperature (2000-6500K)",
                        "minimum": 2000,
                        "maximum": 6500,
                    },
                },
                "required": ["entity_id", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "control_climate",
            "description": "Control air conditioner/heater",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "enum": ["climate.living_room", "climate.bedroom"],
                    },
                    "action": {
                        "type": "string",
                        "enum": ["set_temperature", "turn_off", "set_mode"],
                    },
                    "temperature": {
                        "type": "number",
                        "description": "Target temperature (Celsius)",
                    },
                    "hvac_mode": {
                        "type": "string",
                        "enum": ["heat", "cool", "auto", "off"],
                    },
                },
                "required": ["entity_id", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_value",
            "description": "Get sensor values",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity_id": {
                        "type": "string",
                        "description": "Entity ID of the sensor",
                        "enum": [
                            "sensor.temperature_living_room",
                            "sensor.humidity_living_room",
                            "sensor.co2_living_room",
                            "sensor.power_consumption",
                        ],
                    },
                },
                "required": ["entity_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "activate_scene",
            "description": "Activate a scene (preset)",
            "parameters": {
                "type": "object",
                "properties": {
                    "scene_name": {
                        "type": "string",
                        "enum": [
                            "scene.movie_time",
                            "scene.good_morning",
                            "scene.good_night",
                            "scene.away_mode",
                            "scene.party",
                        ],
                    },
                },
                "required": ["scene_name"],
            },
        },
    },
]

def process_user_command(user_input: str):
    """Process natural language commands from the user"""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a smart home assistant. "
                "Understand the user's request and call the appropriate function. "
                "Ask for confirmation if the request is ambiguous."
            ),
        },
        {"role": "user", "content": user_input},
    ]

    response = client.chat.completions.create(
        model="llama3.1:8b",
        messages=messages,
        tools=tools,
        tool_choice="auto",
    )

    message = response.choices[0].message

    if message.tool_calls:
        results = []
        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            func_args = json.loads(tool_call.function.arguments)

            # Call Home Assistant API
            result = execute_ha_service(func_name, func_args)
            results.append({
                "function": func_name,
                "args": func_args,
                "result": result,
            })

        return results
    else:
        return {"response": message.content}


def execute_ha_service(func_name: str, args: dict) -> str:
    """Execute a Home Assistant service"""
    import requests

    ha_url = "http://192.168.1.100:8123"
    ha_token = "YOUR_LONG_LIVED_TOKEN"
    headers = {
        "Authorization": f"Bearer {ha_token}",
        "Content-Type": "application/json",
    }

    if func_name == "control_light":
        service = f"light/{args['action']}"
        data = {"entity_id": args["entity_id"]}
        if "brightness_pct" in args:
            data["brightness_pct"] = args["brightness_pct"]
        if "color_temp_kelvin" in args:
            data["color_temp_kelvin"] = args["color_temp_kelvin"]

    elif func_name == "control_climate":
        if args["action"] == "set_temperature":
            service = "climate/set_temperature"
            data = {
                "entity_id": args["entity_id"],
                "temperature": args.get("temperature", 22),
            }
        elif args["action"] == "set_mode":
            service = "climate/set_hvac_mode"
            data = {
                "entity_id": args["entity_id"],
                "hvac_mode": args.get("hvac_mode", "auto"),
            }
        else:
            service = "climate/turn_off"
            data = {"entity_id": args["entity_id"]}

    elif func_name == "get_sensor_value":
        resp = requests.get(
            f"{ha_url}/api/states/{args['entity_id']}",
            headers=headers,
        )
        state = resp.json()
        return f"{state['attributes'].get('friendly_name')}: {state['state']} {state['attributes'].get('unit_of_measurement', '')}"

    elif func_name == "activate_scene":
        service = "scene/turn_on"
        data = {"entity_id": args["scene_name"]}

    else:
        return f"Unknown function: {func_name}"

    resp = requests.post(
        f"{ha_url}/api/services/{service}",
        headers=headers,
        json=data,
    )
    return f"OK (status: {resp.status_code})"


# Usage examples
if __name__ == "__main__":
    commands = [
        "Set the living room lights to warm color at 50%",
        "What's the current room temperature?",
        "Switch to movie mode",
        "Set the bedroom AC to 25 degrees",
        "Turn on away mode",
    ]
    for cmd in commands:
        print(f"\nUser: {cmd}")
        result = process_user_command(cmd)
        print(f"Result: {json.dumps(result, ensure_ascii=False, indent=2)}")
```

---

## 6. Security and Privacy

### Smart Home Security Layers

```
+-----------------------------------------------------------+
|  Smart Home Security Layers                                |
+-----------------------------------------------------------+
|                                                           |
|  Layer 4: Application Security                            |
|  +-- Two-factor authentication (2FA)                      |
|  +-- Access log monitoring                                |
|  +-- Guest access expiration management                   |
|                                                           |
|  Layer 3: Protocol Security                               |
|  +-- Matter: CASE (Certificate Authentication)            |
|  +-- HomeKit: Ed25519 encryption                          |
|  +-- TLS 1.3 communication encryption                     |
|                                                           |
|  Layer 2: Network Security                                |
|  +-- Dedicated IoT VLAN isolation                         |
|  +-- Firewall rules                                       |
|  +-- DNS over HTTPS (DoH)                                 |
|                                                           |
|  Layer 1: Device Security                                 |
|  +-- Automatic firmware updates                           |
|  +-- Secure boot                                          |
|  +-- Changing default passwords                           |
+-----------------------------------------------------------+
```

### Specific IoT VLAN Isolation Configuration

```
# IoT VLAN configuration example for UniFi / pfSense

[Network Design]
+-----------------------------------------------------+
| VLAN 1 (Default): Management network                 |
|   192.168.1.0/24                                     |
|   Devices: PC, smartphone, NAS                       |
|   -> Full access                                     |
+-----------------------------------------------------+
| VLAN 10: IoT devices                                 |
|   192.168.10.0/24                                    |
|   Devices: Lights, sensors, smart plugs              |
|   -> Internet restricted, no access to VLAN 1        |
+-----------------------------------------------------+
| VLAN 20: Camera dedicated                            |
|   192.168.20.0/24                                    |
|   Devices: IP cameras, NVR                           |
|   -> Internet access completely blocked              |
|   -> Only NVR (192.168.1.x) access allowed           |
+-----------------------------------------------------+
| VLAN 30: Guest                                       |
|   192.168.30.0/24                                    |
|   Devices: Guest smartphones                         |
|   -> Internet only, no LAN access                    |
+-----------------------------------------------------+
```

```bash
# pfSense firewall rules (conceptual)
# /etc/pf.conf

# IoT VLAN -> Main LAN: Block
block in on $iot_vlan from 192.168.10.0/24 to 192.168.1.0/24

# IoT VLAN -> Allow only Home Assistant
pass in on $iot_vlan from 192.168.10.0/24 to 192.168.1.100 port 8123

# IoT VLAN -> Allow only MQTT Broker
pass in on $iot_vlan from 192.168.10.0/24 to 192.168.1.100 port 1883

# IoT VLAN -> Allow only DNS (Pi-hole/AdGuard)
pass in on $iot_vlan from 192.168.10.0/24 to 192.168.1.53 port 53

# Camera VLAN -> Complete isolation
block in on $camera_vlan from 192.168.20.0/24 to any
pass in on $camera_vlan from 192.168.20.0/24 to 192.168.1.100  # NVR only

# Guest VLAN -> Internet only
block in on $guest_vlan from 192.168.30.0/24 to 192.168.0.0/16
pass in on $guest_vlan from 192.168.30.0/24 to any
```

### DNS Filtering for IoT Security

```yaml
# AdGuard Home configuration - Filtering for IoT devices
# /opt/adguardhome/conf/AdGuardHome.yaml (excerpt)

dns:
  bind_hosts:
    - 192.168.1.53
  port: 53
  upstream_dns:
    - https://dns.cloudflare.com/dns-query  # DoH
    - https://dns.google/dns-query

filtering:
  # Block IoT device telemetry
  rewrites:
    # Block phone-home communications from Chinese IoT devices
    - domain: "*.tuya.com"
      answer: "0.0.0.0"
    - domain: "*.tuyaus.com"
      answer: "0.0.0.0"
    # Block camera cloud uploads
    - domain: "*.xiongmaitech.com"
      answer: "0.0.0.0"
    # Block smart TV tracking
    - domain: "*.samsungacr.com"
      answer: "0.0.0.0"
    - domain: "*.lgtvsdp.com"
      answer: "0.0.0.0"

clients:
  # IoT device group
  runtime_sources:
    - name: "IoT Devices"
      ids:
        - "192.168.10.0/24"
      tags:
        - "device_iot"
      use_global_blocked_services: false
      blocked_services:
        - facebook
        - tiktok
      filtering_enabled: true
      parental_enabled: false
      safesearch_enabled: false
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Connecting All Devices via Wi-Fi

```
BAD: Connecting all lights, sensors, and cameras via Wi-Fi
    -> Exceeds Wi-Fi router connection limit (typically 30-50 devices)
    -> Increased latency, network instability

GOOD: Use the right protocol for each use case
    Wi-Fi: Cameras (requires high bandwidth), smart displays
    Thread: Lights, temperature sensors, door sensors (low power mesh)
    Zigbee: Existing IKEA and Philips Hue devices
    Bluetooth: Beacons, short-range temporary connections
```

### Anti-Pattern 2: Over-Reliance on Cloud Services

```
BAD: Depending entirely on cloud services for all automation
    -> Everything stops when internet is disconnected
    -> All devices become bricked when service is discontinued

GOOD: Local-first design
    1. Use a local hub like Home Assistant as the core
    2. Basic controls for lights and door locks work locally
    3. Cloud is only for added value (remote access, AI features)
    4. Prioritize Matter/Thread-compatible devices (local communication capable)
```

### Anti-Pattern 3: Deploying Devices Without Security Measures

```
BAD: Deploying cheap IoT devices without any precautions
    -> Running with default passwords (admin/admin)
    -> Constant communication to cloud servers (data leak risk)
    -> No firmware updates (known vulnerabilities left unpatched)
    -> All devices on a flat network

GOOD: Staged security measures
    1. VLAN isolation: Isolate IoT devices on a dedicated network
    2. DNS filtering: Block unnecessary external communications
    3. Firmware: Choose devices that support automatic updates
    4. Authentication: Change all device passwords, enable 2FA where possible
    5. Auditing: Monitor network for anomalous communications
```

### Anti-Pattern 4: Confusion from Excessive Automation

```
BAD: Creating massive numbers of automation rules with overly complex conditions
    -> Rules conflict (an automation to turn lights ON and one to turn lights OFF fire simultaneously)
    -> Difficult to debug (cannot determine why a light turned on)
    -> Family members can no longer operate things manually

GOOD: Automation design principles
    1. Keep it simple: No more than 3 conditions per automation
    2. Priority management: Manual override > Automation (suppress automation for a set period after manual operation)
    3. Feedback: Notify on automation execution (LED, sound, app notification)
    4. Kill switch: Have a switch to disable all automations at once
    5. Gradual rollout: Add one at a time and verify behavior
    6. Documentation: Describe the intent and conditions in comments
```

### Anti-Pattern 5: Lack of Backup Strategy

```
BAD: Not backing up Home Assistant configuration
    -> All settings lost when SD card fails
    -> Dozens of hours of automation rules gone in an instant
    -> Device re-pairing required

GOOD: Multi-layered backup strategy
    1. Automatic snapshots: Daily automatic HA backup at midnight
    2. External storage: Sync backups to Google Drive / NAS
    3. Git management: Manage YAML config files in a Git repository
    4. SSD upgrade: Replace Raspberry Pi SD card with SSD/NVMe
    5. HA OS: Use the dedicated OS for easy snapshot restoration

Configuration example (Home Assistant backup automation):
```

```yaml
# Home Assistant backup automation
- alias: "Daily automatic backup"
  trigger:
    - platform: time
      at: "03:00:00"
  action:
    - service: backup.create
      data:
        name: "auto_backup_{{ now().strftime('%Y%m%d') }}"
    # Upload to Google Drive (Google Drive Backup add-on)
    - delay: "00:05:00"
    - service: hassio.addon_stdin
      data:
        addon: cebe7a76_hassio_google_drive_backup
        input:
          command: "backup"
```

---

## 8. Smart Home Practical Implementation Guide

### Configuration Examples by Budget

```
[Minimal Configuration] Budget: $150-200
├── Raspberry Pi 5 (4GB): $80
├── Zigbee USB dongle (SONOFF ZBDongle-E): $17
├── Smart lights x3 (IKEA TRADFRI): $40
├── Temperature/humidity sensors x2 (Aqara): $27
└── Smart plugs x2 (TP-Link): $20

[Standard Configuration] Budget: $350-550
├── Home Assistant Green: $100
├── Thread Border Router (Apple TV 4K): $150
├── Matter-compatible lights x5 (Nanoleaf/Eve): $100
├── Smart lock (SwitchBot Lock Pro): $80
├── Temperature/humidity/CO2 sensor (Aqara): $55
├── Smart curtain (SwitchBot): $55
└── Smart plugs x3: $35

[Full Configuration] Budget: $1,000-1,700
├── Home Assistant Yellow (PoE): $170
├── UniFi Dream Machine SE: $340
├── Thread/Matter lighting system: $200
├── Frigate NVR + Coral USB: $100
├── IP cameras x3 (Reolink PoE): $200
├── ESP32-S3-BOX x2 (voice satellites): $55
├── Smart lock + keypad: $135
├── Various sensor array: $100
├── Smart curtains x3: $165
└── UPS (power outage protection): $100
```

### Phased Rollout Roadmap

```
[Phase 1: Foundation Building (1-2 weeks)]
Day 1-2: Hardware setup
  └── Install Home Assistant, configure network

Day 3-5: Basic device connections
  └── Pair lights, plugs, and sensors

Day 6-7: Basic automation
  └── Sunset lighting, away mode, temperature alerts

Day 8-14: Stability verification
  └── Run for one week to identify issues

[Phase 2: Expansion (Weeks 3-4)]
Week 3: Security hardening
  └── VLAN isolation, DNS filtering, backup configuration

Week 4: AI feature additions
  └── Frigate NVR, voice assistant (Wyoming)

[Phase 3: Optimization (Month 2 onwards)]
Month 2: Advanced automation
  └── Behavior pattern learning, energy optimization

Month 3+: Continuous improvement
  └── Add new devices, tune automations
```

---

## FAQ

### Q1. Should I buy Matter-compatible or non-compatible devices?

For future purchases, Matter-compatible devices are generally recommended. Matter-compatible devices work with Apple Home, Google Home, and Amazon Alexa, avoiding vendor lock-in. However, the existing Zigbee ecosystem (IKEA TRADFRI, Philips Hue) supports Matter via bridges, so there is no need to replace existing devices.

### Q2. What is the cost and difficulty of deploying Home Assistant?

You can get started with a minimum investment by installing it on a Raspberry Pi 4/5 ($60-130). Dedicated hardware options include Home Assistant Green (approximately $100) and Home Assistant Yellow. Initial setup is done through a GUI, and basic automation does not require YAML. Advanced customization requires YAML and Python knowledge.

### Q3. Are voice assistant privacy concerns warranted?

Amazon Alexa and Google Assistant send voice data to the cloud by default. If privacy is important: 1) Configure automatic deletion of voice recordings, 2) Use Apple Siri (focuses on on-device processing), 3) Completely eliminate cloud dependency with Home Assistant's local voice processing (Wyoming protocol + Whisper + Piper).

### Q4. Should I choose Thread or Zigbee?

For new purchases, Thread is recommended. Thread is IPv6-native and positioned as Matter's recommended transport layer. However, the variety of Zigbee devices currently available is overwhelmingly larger. If you have existing Zigbee devices, a practical "coexistence strategy" is to integrate them with Home Assistant via Zigbee2MQTT while choosing Thread/Matter-compatible devices for new purchases. Thread Border Routers are supported by Apple TV 4K, HomePod mini, and Google Nest Hub (2nd gen), so if you own any of these, you can build a Thread network at no additional cost.

### Q5. What happens when smart home devices exceed 100?

As device count increases, the following issues tend to arise. (1) Wi-Fi-only configurations suffer from bandwidth shortages and degraded responsiveness. Distribute the load with Thread/Zigbee mesh. (2) Home Assistant automations become complex and boot time increases. Split YAML files and manage them with a package structure (packages directory). (3) Dashboards become cluttered. Create room-based and function-based views, and use custom:auto-entities cards for dynamic filtering. (4) mDNS/DNS-SD broadcasts increase, so pay attention to network equipment processing capability. Enterprise-grade routers (such as UniFi Dream Machine) are recommended.

### Q6. What happens to a smart home during a power outage?

Connecting a UPS (Uninterruptible Power Supply) to the Home Assistant server and network equipment enables operation for tens of minutes to several hours after an outage. Smart locks are battery-powered and unaffected by power outages. Lights and air conditioners physically stop, but automation can be set up to automatically restore the previous state when power returns. With battery storage (Tesla Powerwall, etc.) combined with solar generation, complete power outage protection is possible. Using Home Assistant's NUT (Network UPS Tools) integration to monitor UPS status and automating a safe shutdown when battery levels drop low is also recommended.

---

## Summary

| Concept | Key Points |
|------|------|
| Matter | Unified smart home standard from Apple/Google/Amazon |
| Thread | Low-power mesh network (Matter's recommended communication layer) |
| Home Assistant | Open-source local smart home hub |
| Voice Assistants | Alexa/Google/Siri + local LLM options |
| Frigate NVR | Local AI camera (Coral-compatible) |
| Local-First | Design where basic functions work without internet |
| VLAN Isolation | Isolating IoT devices from the main network |
| Energy Optimization AI | Automatic temperature control through behavior prediction |
| HEMS | Integrated energy management with solar + battery + dynamic pricing |
| Wyoming Protocol | Microservice connection standard for local voice processing |

---

## Recommended Next Guides

- **02-emerging/03-future-hardware.md** — Future Hardware: Quantum Computers, Neuromorphic
- **02-emerging/01-robotics.md** — Robotics: Boston Dynamics, Figure
- **01-computing/02-edge-ai.md** — Edge AI: NPU, Coral, Jetson

---

## References

1. **CSA — Matter Specification** https://csa-iot.org/all-solutions/matter/
2. **Home Assistant Official Documentation** https://www.home-assistant.io/docs/
3. **Thread Group Official** https://www.threadgroup.org/
4. **Frigate NVR** https://docs.frigate.video/
5. **ESPHome Voice Assistant** https://esphome.io/components/voice_assistant.html
6. **Wyoming Protocol** https://github.com/rhasspy/wyoming
7. **Matter SDK (connectedhomeip)** https://github.com/project-chip/connectedhomeip
8. **OpenThread** https://openthread.io/
