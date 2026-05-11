# Future Hardware Guide

> An overview of next-generation computing technologies including quantum computers, neuromorphic chips, and optical computing

## What You Will Learn in This Chapter

1. **Quantum Computers** — Qubits, quantum gates, the current state of the NISQ era, and the path to practical use
2. **Neuromorphic Chips** — Principles and applications of brain-inspired, energy-efficient AI-dedicated chips
3. **Optical Computing** — How photon-based computation works and its potential for AI inference
4. **Quantum x AI Convergence** — Quantum machine learning, variational algorithms, quantum reinforcement learning
5. **DNA Computing** — Molecular-level information processing and ultra-high-density storage
6. **Reversible Computing** — Theoretically energy-free computation beyond the Landauer limit
7. **Practical Roadmap** — Skills and decision criteria engineers should start preparing now


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Understanding of the content in the [Smart Home Guide](./02-smart-home.md)

---

## 1. Quantum Computers

### Classical Computers vs Quantum Computers

```
+----------------------------------+   +----------------------------------+
|      Classical Computer           |   |      Quantum Computer             |
+----------------------------------+   +----------------------------------+
|                                  |   |                                  |
|  Bit: 0 or 1                    |   |  Qubit: Superposition of 0 and 1 |
|                                  |   |                                  |
|  +---+  +---+                    |   |  +-------+                      |
|  | 0 |  | 1 |  Definite state    |   |  | α|0⟩  |  Probabilistic state |
|  +---+  +---+                    |   |  | +β|1⟩ |  (Superposition)     |
|                                  |   |  +-------+                      |
|                                  |   |                                  |
|  n bits → 1 state               |   |  n qubits → Hold and operate    |
|  Search 2^n possibilities       |   |  on 2^n states simultaneously   |
|  sequentially                    |   |                                  |
|                                  |   |                                  |
|  100 bits = one 100-digit number |   |  100 qubits = 2^100 states      |
|                                  |   |  ≒ Comparable to the number of  |
|                                  |   |    atoms in the universe         |
+----------------------------------+   +----------------------------------+
```

### Three Fundamental Principles of Quantum Mechanics

Here we organize the minimum quantum mechanics principles needed to understand quantum computers.

```
+-----------------------------------------------------------+
|  Three Principles Underpinning Quantum Computing            |
+-----------------------------------------------------------+
|                                                           |
|  1. Superposition                                          |
|     ┌───────────────────────────────────┐                 |
|     │ |ψ⟩ = α|0⟩ + β|1⟩                │                 |
|     │ |α|² + |β|² = 1 (Probability      │                 |
|     │                   normalization)   │                 |
|     │                                   │                 |
|     │ Until measured, the qubit holds    │                 |
|     │ both 0 and 1 states simultaneously │                 |
|     └───────────────────────────────────┘                 |
|                                                           |
|  2. Entanglement                                           |
|     ┌───────────────────────────────────┐                 |
|     │ |Φ+⟩ = (|00⟩ + |11⟩) / √2        │                 |
|     │                                   │                 |
|     │ Two qubits are correlated         │                 |
|     │ Measuring one determines the other │                 |
|     │ Distance-independent (non-locality)│                 |
|     └───────────────────────────────────┘                 |
|                                                           |
|  3. Interference                                           |
|     ┌───────────────────────────────────┐                 |
|     │ Amplify the probability amplitude  │                 |
|     │ of correct answers, and weaken     │                 |
|     │ that of incorrect answers          │                 |
|     │                                   │                 |
|     │ Constructive: Amplitudes add       │                 |
|     │ Destructive: Amplitudes cancel     │                 |
|     │ → Core of quantum algorithms      │                 |
|     └───────────────────────────────────┘                 |
+-----------------------------------------------------------+
```

### Major Quantum Computer Implementations

```
+-----------------------------------------------------------+
|  Quantum Computer Implementation Types                      |
+-----------------------------------------------------------+
|                                                           |
|  Superconducting Qubits                                    |
|  +-- IBM (Eagle 127→Condor 1121 qubits)                  |
|  +-- Google (Sycamore 72 → Willow 105 qubits)            |
|  +-- Operating temperature: 15 mK (-273.135°C)            |
|  +-- Gate speed: ~20ns                                     |
|  +-- Coherence time: ~100μs                               |
|  +-- Advantage: High compatibility with semiconductor      |
|  |   manufacturing technology                              |
|  +-- Challenge: Cryogenic cooling is large-scale and       |
|      expensive                                             |
|                                                           |
|  Ion Trap                                                  |
|  +-- IonQ (Forte: 36 algorithmic qubits)                  |
|  +-- Quantinuum (H2: 56 qubits)                          |
|  +-- Operating temperature: Room temperature (in vacuum)   |
|  +-- Gate fidelity: 99.9%+                                 |
|  +-- Coherence time: ~seconds                              |
|  +-- Advantage: Highest gate fidelity                      |
|  +-- Challenge: Slow gate speed, difficult scaling         |
|                                                           |
|  Photonic Quantum                                          |
|  +-- PsiQuantum, Xanadu                                   |
|  +-- Room temperature operation possible                   |
|  +-- Potential for large-scale systems                     |
|  +-- Advantage: Integrable with existing fiber optic       |
|  |   infrastructure                                        |
|  +-- Challenge: Deterministic two-qubit gates are          |
|      difficult                                             |
|                                                           |
|  Neutral Atom                                              |
|  +-- QuEra (256+ qubits)                                  |
|  +-- Favorable for scaling                                 |
|  +-- Advantage: High connectivity between qubits           |
|  +-- Challenge: Gate speed, atom retention time            |
|                                                           |
|  Topological Qubits                                        |
|  +-- Microsoft (Majorana 1 chip, announced 2025)           |
|  +-- Inherently error-resistant                            |
|  +-- Advantage: Low quantum error correction overhead      |
|  +-- Challenge: Experimental demonstration just beginning  |
+-----------------------------------------------------------+
```

### Fundamentals of Quantum Error Correction

The biggest challenge for quantum computers is qubit noise (decoherence). Without error correction, practical computation is nearly impossible.

```
+-----------------------------------------------------------+
|  Quantum Error Correction Concepts                          |
+-----------------------------------------------------------+
|                                                           |
|  Physical Qubits → Logical Qubits                          |
|                                                           |
|  ┌─────────────────────────────┐                          |
|  │  1 Logical Qubit              │                          |
|  │  ┌───┐┌───┐┌───┐┌───┐      │                          |
|  │  │ P1││ P2││ P3││...│      │  P = Physical Qubit       |
|  │  └───┘└───┘└───┘└───┘      │                          |
|  │  Error Detection & Correction │                          |
|  │  Syndrome Measurement         │                          |
|  └─────────────────────────────┘                          |
|                                                           |
|  Representative Error Correction Codes:                     |
|  ┌─────────────────────────────────────────┐              |
|  │  Surface Code                             │              |
|  │  - Most promising error correction code   │              |
|  │  - Physical qubits arranged on a 2D       │              |
|  │    lattice                                │              |
|  │  - Data qubits and ancilla qubits         │              |
|  │  - Operates with physical error rate < 1% │              |
|  │  - 1 logical qubit ≒ 1,000-10,000         │              |
|  │    physical qubits                        │              |
|  │                                           │              |
|  │  Estimated physical qubits needed:        │              |
|  │  RSA-2048 cracking: ~4 million physical   │              |
|  │  Practical chemistry: ~100K physical      │              |
|  │  Current maximum: ~1,000 physical         │              |
|  └─────────────────────────────────────────┘              |
+-----------------------------------------------------------+
```

### Code Example 1: Quantum Circuit with Qiskit

```python
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.visualization import plot_histogram

# Create a quantum circuit (2-qubit Bell state)
qc = QuantumCircuit(2, 2)

# Hadamard gate: |0⟩ → (|0⟩ + |1⟩) / √2  (Superposition)
qc.h(0)

# CNOT gate: Generate entanglement
qc.cx(0, 1)

# Measurement
qc.measure([0, 1], [0, 1])

print(qc.draw())
#      ┌───┐     ┌─┐
# q_0: ┤ H ├──■──┤M├───
#      └───┘┌─┴─┐└╥┘┌─┐
# q_1: ────┤ X ├─╫─┤M├
#           └───┘ ║ └╥┘
# c: 2/══════════╩══╩═
#                 0  1

# Run simulation
simulator = AerSimulator()
compiled = transpile(qc, simulator)
result = simulator.run(compiled, shots=1000).result()
counts = result.get_counts()
print(counts)  # {'00': 498, '11': 502}
# → |00⟩ and |11⟩ appear with nearly equal probability (entanglement)
```

### Code Example 2: Quantum Machine Learning (QML)

```python
from qiskit.circuit.library import ZZFeatureMap, RealAmplitudes
from qiskit_machine_learning.algorithms import VQC
from qiskit_algorithms.optimizers import COBYLA

# Quantum variational classifier
feature_map = ZZFeatureMap(feature_dimension=2, reps=2)
ansatz = RealAmplitudes(num_qubits=2, reps=2)

vqc = VQC(
    feature_map=feature_map,
    ansatz=ansatz,
    optimizer=COBYLA(maxiter=100),
    quantum_instance=AerSimulator(),
)

# Training
vqc.fit(X_train, y_train)

# Prediction
predictions = vqc.predict(X_test)
accuracy = np.mean(predictions == y_test)
print(f"Quantum classifier accuracy: {accuracy:.2%}")
```

### Code Example 2b: Grover's Search Algorithm

```python
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit.visualization import plot_histogram
import numpy as np

def grover_search(n_qubits: int, target_state: str) -> dict:
    """
    Implementation of Grover's search algorithm
    Finds a target element from N elements in O(√N)
    Quadratic speedup over classical O(N)

    Parameters
    ----------
    n_qubits : int
        Number of qubits (search space = 2^n_qubits)
    target_state : str
        Target state to search for (e.g., '101')

    Returns
    -------
    dict
        Frequency dictionary of measurement results
    """
    qc = QuantumCircuit(n_qubits, n_qubits)

    # Step 1: Create uniform superposition state
    qc.h(range(n_qubits))

    # Optimal number of iterations: π/4 * √(2^n)
    num_iterations = int(np.pi / 4 * np.sqrt(2 ** n_qubits))

    for _ in range(num_iterations):
        # Step 2: Oracle — Flip the phase of the target state
        # Apply X gate to bits corresponding to '0' in target_state
        for i, bit in enumerate(reversed(target_state)):
            if bit == '0':
                qc.x(i)

        # Multi-controlled Z gate (phase flip)
        qc.h(n_qubits - 1)
        qc.mcx(list(range(n_qubits - 1)), n_qubits - 1)
        qc.h(n_qubits - 1)

        # Undo X gates
        for i, bit in enumerate(reversed(target_state)):
            if bit == '0':
                qc.x(i)

        # Step 3: Diffusion operator (amplitude amplification)
        qc.h(range(n_qubits))
        qc.x(range(n_qubits))

        qc.h(n_qubits - 1)
        qc.mcx(list(range(n_qubits - 1)), n_qubits - 1)
        qc.h(n_qubits - 1)

        qc.x(range(n_qubits))
        qc.h(range(n_qubits))

    # Measurement
    qc.measure(range(n_qubits), range(n_qubits))

    # Simulation
    simulator = AerSimulator()
    result = simulator.run(qc, shots=1024).result()
    counts = result.get_counts()

    # Display results
    print(f"Search space: 2^{n_qubits} = {2**n_qubits} elements")
    print(f"Target: |{target_state}⟩")
    print(f"Iterations: {num_iterations}")
    print(f"Results: {counts}")
    # The target state is observed with high probability
    return counts

# Example: Search for '101' from 8 elements (3 qubits)
result = grover_search(3, '101')
# Example output:
# Search space: 2^3 = 8 elements
# Target: |101⟩
# Iterations: 2
# Results: {'101': 945, '000': 11, '010': 13, ...}
# → 101 is detected with ~92% probability
```

### Code Example 2c: Quantum Teleportation

```python
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator

def quantum_teleportation():
    """
    Quantum teleportation protocol
    Transfers a quantum state without physically moving it,
    using classical communication and entanglement

    Alice sends qubit |ψ⟩ = α|0⟩ + β|1⟩ to Bob
    """
    # 3 qubits: q0(state to send), q1(Alice), q2(Bob)
    # 2 classical bits: Alice's measurement results
    qc = QuantumCircuit(3, 2)

    # Prepare the state to send (e.g., apply arbitrary rotations to |ψ⟩)
    qc.rx(1.2, 0)   # Rotations that determine α, β
    qc.rz(0.7, 0)

    qc.barrier()

    # Step 1: Generate Bell state (entanglement) between Alice and Bob
    qc.h(1)        # Hadamard gate
    qc.cx(1, 2)    # CNOT → |Φ+⟩ = (|00⟩ + |11⟩)/√2

    qc.barrier()

    # Step 2: Alice performs Bell measurement
    qc.cx(0, 1)    # CNOT
    qc.h(0)        # Hadamard
    qc.measure(0, 0)  # Measure q0 → c0
    qc.measure(1, 1)  # Measure q1 → c1

    qc.barrier()

    # Step 3: Bob applies corrections based on measurement results
    qc.x(2).c_if(1, 1)   # Apply X gate if c1=1
    qc.z(2).c_if(0, 1)   # Apply Z gate if c0=1

    # Bob's q2 is now in the same state as the original |ψ⟩

    print(qc.draw())
    return qc

# Execute
qc = quantum_teleportation()

# Key points:
# - Quantum states cannot be cloned (no-cloning theorem)
# - After teleportation, the original state is destroyed
# - A classical communication channel is required (not faster-than-light)
# - Foundation technology for the quantum internet
```

### Application Domains of Quantum Computers

| Domain | Quantum Algorithm | Speedup vs Classical | Estimated Timeline |
|--------|------------------|---------------------|-------------------|
| Cryptanalysis | Shor's Algorithm | Exponential | 2035-2040 |
| Optimization Problems | QAOA, VQE | Polynomial | 2028-2032 |
| Molecular Simulation | VQE | Exponential | 2028-2032 |
| Machine Learning | QML, QSVM | Undetermined | Research stage |
| Materials Design | Quantum Chemistry | Exponential | 2030-2035 |
| Financial Modeling | Quantum Monte Carlo | Quadratic speedup | 2028-2032 |
| Logistics Optimization | Quantum Annealing | Problem-dependent | 2026-2030 |
| Drug Discovery | Molecular Dynamics | Exponential | 2030-2035 |

### Post-Quantum Cryptography

Migration to new cryptographic algorithms is underway in preparation for advances in quantum computing.

```python
"""
Overview and migration plan for post-quantum cryptography

NIST standardized post-quantum cryptography algorithms in 2024:
- ML-KEM (formerly CRYSTALS-Kyber): Key encapsulation mechanism
- ML-DSA (formerly CRYSTALS-Dilithium): Digital signatures
- SLH-DSA (formerly SPHINCS+): Hash-based signatures

Migration steps enterprises should begin now:
"""

# Migration checklist
pqc_migration_checklist = {
    "Phase 1: Cryptographic Inventory (2024-2025)": [
        "Audit cryptographic algorithms in use",
        "Identify all RSA/ECDSA usage locations",
        "Verify TLS certificate cryptographic methods",
        "Evaluate crypto-agility (ease of switching)",
    ],
    "Phase 2: Hybrid Migration (2025-2028)": [
        "Deploy TLS 1.3 + ML-KEM hybrid mode",
        "Hybridize signatures with ML-DSA",
        "Performance testing in test environments",
        "Assess network impact of increased key sizes",
    ],
    "Phase 3: Full Migration (2028-2035)": [
        "Gradual deprecation of legacy cryptographic algorithms",
        "Complete PQC support across all systems",
        "Re-encrypt long-term stored data",
        "Confirm PQC support across the entire supply chain",
    ],
}

# PQC algorithm comparison
pqc_comparison = {
    "ML-KEM-768": {
        "Purpose": "Key exchange",
        "Public key size": "1184 bytes",
        "Ciphertext size": "1088 bytes",
        "Security level": "NIST Level 3",
        "Performance": "Faster than RSA",
    },
    "ML-DSA-65": {
        "Purpose": "Digital signatures",
        "Public key size": "1952 bytes",
        "Signature size": "3293 bytes",
        "Security level": "NIST Level 3",
        "Performance": "Faster signing than RSA, slightly slower verification",
    },
    "SLH-DSA-SHA2-128s": {
        "Purpose": "Digital signatures (stateless)",
        "Public key size": "32 bytes",
        "Signature size": "7856 bytes",
        "Security level": "NIST Level 1",
        "Performance": "Slow signing, but high theoretical security",
    },
}

for algo, specs in pqc_comparison.items():
    print(f"\n{algo}:")
    for key, value in specs.items():
        print(f"  {key}: {value}")
```

---

## 2. Neuromorphic Chips

### Correspondence Between the Brain and Neuromorphic Chips

```
+-----------------------------------------------------------+
|  Biological Brain vs Neuromorphic Chip                      |
+-----------------------------------------------------------+
|                                                           |
|  Biological Brain            Chip                          |
|  +-----------+               +-----------+                |
|  | Neurons   | ←Corresponds→ | Digital/  |                |
|  | (~86B)    |               | Analog    |                |
|  +-----------+               | Neurons   |                |
|       |                      +-----------+                |
|       | Synapses                   | Weighted connections  |
|       | (~100T)                    | (Memristors, etc.)   |
|       v                           v                      |
|  +-----------+               +-----------+                |
|  | Spikes    | ←Corresponds→ | Spikes    |                |
|  | (Electrical|               | (Event-   |                |
|  |  signals) |               |  driven)  |                |
|  +-----------+               +-----------+                |
|                                                           |
|  Characteristics:                                          |
|  - Event-driven (not always active)                        |
|  - Ultra-low power consumption (brain: ~20W)               |
|  - Massively parallel processing                           |
|  - Learning and inference on the same hardware             |
+-----------------------------------------------------------+
```

### Contrast with the von Neumann Bottleneck

```
+-----------------------------------------------------------+
|  Limitations of Conventional Computers and                  |
|  the Neuromorphic Solution                                  |
+-----------------------------------------------------------+
|                                                           |
|  Von Neumann Architecture:                                 |
|  ┌──────┐     Bus (bandwidth-limited) ┌──────┐            |
|  │ CPU  │ ←─────────────────────────→ │Memory│            |
|  └──────┘   60-90% of energy          └──────┘            |
|              consumed by                                   |
|              data movement                                 |
|                                                           |
|  Neuromorphic Architecture:                                |
|  ┌──────────────────────────────────┐                     |
|  │  Compute and memory unified       │                     |
|  │  (In-Memory Computing)            │                     |
|  │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │                     |
|  │  │N├─┤N├─┤N├─┤N├─┤N├─┤N│      │                     |
|  │  └┬┘ └┬┘ └┬┘ └┬┘ └┬┘ └┬┘      │                     |
|  │   │   │   │   │   │   │        │                     |
|  │  ┌┴┐ ┌┴┐ ┌┴┐ ┌┴┐ ┌┴┐ ┌┴┐      │                     |
|  │  │N├─┤N├─┤N├─┤N├─┤N├─┤N│      │                     |
|  │  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘      │                     |
|  │  N = Neuron (compute + memory)    │                     |
|  │  ─ = Synaptic connection (weight) │                     |
|  │  No data movement → Ultra-low     │                     |
|  │  power consumption                │                     |
|  └──────────────────────────────────┘                     |
+-----------------------------------------------------------+
```

### Major Neuromorphic Chip Comparison

| Chip | Company | Neurons | Synapses | Power | Features |
|------|---------|---------|----------|-------|----------|
| Loihi 2 | Intel | 1M+ | 120M+ | ~1W | Research-oriented, SNN-optimized |
| TrueNorth | IBM | 1M | 256M | 70mW | Ultra-low power |
| SpiNNaker 2 | Univ. of Manchester | Millions | Billions | ~10W | Large-scale brain simulation |
| Akida | BrainChip | Custom | Custom | A few mW | Commercial edge AI |
| Tianjic | Tsinghua Univ. | Hybrid | - | ~1W | ANN+SNN integration |
| Hala Point | Intel | 1.15B+ | 128B+ | ~100W | Large-scale Loihi 2-based system |

### Code Example 3: Spiking Neural Network (SNN)

```python
import snntorch as snn
import torch
import torch.nn as nn

class SpikingNet(nn.Module):
    """
    Spiking Neural Network
    Unlike conventional ANNs, neurons either "fire" or don't (binary)
    Can naturally process temporal information
    """
    def __init__(self, num_inputs=784, num_hidden=256, num_outputs=10,
                 beta=0.95, num_steps=25):
        super().__init__()
        self.num_steps = num_steps

        # Fully connected layers
        self.fc1 = nn.Linear(num_inputs, num_hidden)
        self.fc2 = nn.Linear(num_hidden, num_outputs)

        # Leaky Integrate-and-Fire (LIF) neurons
        self.lif1 = snn.Leaky(beta=beta)  # beta: membrane potential decay rate
        self.lif2 = snn.Leaky(beta=beta)

    def forward(self, x):
        # Initialize membrane potentials
        mem1 = self.lif1.init_leaky()
        mem2 = self.lif2.init_leaky()

        spk2_rec = []  # Record output spikes
        mem2_rec = []  # Record membrane potentials

        # Process each time step
        for step in range(self.num_steps):
            cur1 = self.fc1(x)
            spk1, mem1 = self.lif1(cur1, mem1)

            cur2 = self.fc2(spk1)
            spk2, mem2 = self.lif2(cur2, mem2)

            spk2_rec.append(spk2)
            mem2_rec.append(mem2)

        # Classify by spike firing rate
        return torch.stack(spk2_rec), torch.stack(mem2_rec)

# Training loop
net = SpikingNet()
optimizer = torch.optim.Adam(net.parameters(), lr=1e-3)
loss_fn = snn.functional.ce_rate_loss()  # Spike rate-based loss

for epoch in range(10):
    for data, targets in train_loader:
        spk_rec, mem_rec = net(data)
        loss = loss_fn(spk_rec, targets)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

### Code Example 3b: Processing Event Camera Data

```python
import torch
import torch.nn as nn
import snntorch as snn
from snntorch import spikegen

class EventDrivenVisionNet(nn.Module):
    """
    Network for processing event camera (DVS: Dynamic Vision Sensor)
    data with SNNs

    Event camera characteristics:
    - Detects brightness changes per pixel, not frame-based
    - Microsecond temporal resolution
    - High dynamic range (120dB+)
    - Low power consumption, low data rate
    - Gaining attention in autonomous driving and robotics

    Excellent compatibility with SNNs:
    - Both are event-driven
    - Efficiently process sparse data
    """
    def __init__(self, input_channels=2, num_classes=10,
                 beta=0.9, num_steps=50):
        super().__init__()
        self.num_steps = num_steps

        # Convolutional layers (spatiotemporal feature extraction)
        self.conv1 = nn.Conv2d(input_channels, 32, 3, padding=1)
        self.pool1 = nn.AvgPool2d(2)
        self.lif1 = snn.Leaky(beta=beta)

        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.pool2 = nn.AvgPool2d(2)
        self.lif2 = snn.Leaky(beta=beta)

        self.conv3 = nn.Conv2d(64, 128, 3, padding=1)
        self.pool3 = nn.AvgPool2d(2)
        self.lif3 = snn.Leaky(beta=beta)

        # Fully connected classification layer
        self.fc1 = nn.Linear(128 * 4 * 4, 256)
        self.lif4 = snn.Leaky(beta=beta)

        self.fc2 = nn.Linear(256, num_classes)
        self.lif5 = snn.Leaky(beta=beta)

    def forward(self, event_stream):
        """
        Parameters
        ----------
        event_stream : torch.Tensor
            Shape [batch, time_steps, channels, height, width]
            channels: 2 channels for ON/OFF events
        """
        mem1 = self.lif1.init_leaky()
        mem2 = self.lif2.init_leaky()
        mem3 = self.lif3.init_leaky()
        mem4 = self.lif4.init_leaky()
        mem5 = self.lif5.init_leaky()

        spk_out_rec = []

        for t in range(self.num_steps):
            x = event_stream[:, t]  # Event frame at time t

            # Convolution + Spiking
            x = self.pool1(self.conv1(x))
            spk1, mem1 = self.lif1(x, mem1)

            x = self.pool2(self.conv2(spk1))
            spk2, mem2 = self.lif2(x, mem2)

            x = self.pool3(self.conv3(spk2))
            spk3, mem3 = self.lif3(x, mem3)

            # Flatten
            x = spk3.view(spk3.size(0), -1)

            x = self.fc1(x)
            spk4, mem4 = self.lif4(x, mem4)

            x = self.fc2(spk4)
            spk5, mem5 = self.lif5(x, mem5)

            spk_out_rec.append(spk5)

        return torch.stack(spk_out_rec)

# Energy efficiency comparison (per inference)
energy_comparison = {
    "GPU (NVIDIA A100)": {
        "Power consumption": "300W",
        "Inference latency": "1ms",
        "Energy/inference": "300mJ",
        "Throughput": "Thousands of FPS",
    },
    "Loihi 2": {
        "Power consumption": "1W",
        "Inference latency": "5ms",
        "Energy/inference": "5mJ",
        "Throughput": "200FPS",
    },
    "Akida (BrainChip)": {
        "Power consumption": "A few mW",
        "Inference latency": "1ms",
        "Energy/inference": "A few μJ",
        "Throughput": "30FPS",
    },
}
# Loihi 2 can perform inference with 1/60th the energy of a GPU
# Akida uses less than 1/1000th
```

### Code Example 3c: Programming Loihi 2 with the Lava Framework

```python
"""
Neuromorphic computing with Intel Lava framework
Can run directly on the Loihi 2 chip

Lava provides a hardware abstraction layer,
allowing switching between CPU/GPU simulation and Loihi hardware
"""
from lava.proc.lif.process import LIF
from lava.proc.dense.process import Dense
from lava.proc.io.source import RingBuffer as Source
from lava.proc.io.sink import RingBuffer as Sink
from lava.magma.core.run_configs import Loihi2SimCfg
from lava.magma.core.run_conditions import RunSteps
import numpy as np

# Network configuration
num_inputs = 64
num_hidden = 128
num_outputs = 10
num_steps = 100

# Input data (represented as spike trains)
input_spikes = np.random.binomial(1, 0.1, (num_inputs, num_steps))

# Process (node) definitions
source = Source(data=input_spikes)

# Dense (fully connected synapses)
weights_1 = np.random.randn(num_hidden, num_inputs) * 0.1
dense_1 = Dense(weights=weights_1)

# LIF neurons
lif_1 = LIF(
    shape=(num_hidden,),
    vth=1.0,        # Firing threshold
    du=0.9,         # Current decay rate
    dv=0.8,         # Voltage decay rate
    bias_mant=0,    # Bias
)

weights_2 = np.random.randn(num_outputs, num_hidden) * 0.1
dense_2 = Dense(weights=weights_2)

lif_2 = LIF(
    shape=(num_outputs,),
    vth=1.0,
    du=0.9,
    dv=0.8,
)

sink = Sink(shape=(num_outputs,), buffer=num_steps)

# Connect processes (dataflow graph)
source.s_out.connect(dense_1.s_in)
dense_1.a_out.connect(lif_1.a_in)
lif_1.s_out.connect(dense_2.s_in)
dense_2.a_out.connect(lif_2.a_in)
lif_2.s_out.connect(sink.a_in)

# Execute (simulation mode)
run_cfg = Loihi2SimCfg()
lif_2.run(condition=RunSteps(num_steps=num_steps), run_cfg=run_cfg)

# Get output spikes
output_spikes = sink.data.get()
print(f"Output spike shape: {output_spikes.shape}")  # (10, 100)
print(f"Firing rate per neuron: {output_spikes.mean(axis=1)}")

# Stop
lif_2.stop()

# To run on actual Loihi 2 hardware:
# run_cfg = Loihi2HwCfg()  # Just switch to hardware config
# No code changes needed → Benefit of hardware abstraction
```

---

## 3. Optical Computing

### Principles of Optical Computing

```
+-----------------------------------------------------------+
|  How Optical Computing Works                                |
+-----------------------------------------------------------+
|                                                           |
|  Electronic computer:                                      |
|  Input(electrical) → Transistor(switch) → Output(electrical)|
|  - Generates large amounts of heat                         |
|  - Wiring delays                                           |
|                                                           |
|  Optical computer:                                         |
|  Input(light) → Optical elements(interference/diffraction) |
|  → Output(light)                                           |
|  - Extremely low heat generation                           |
|  - Computes at the speed of light                          |
|                                                           |
|  Optical implementation of matrix multiplication:           |
|                                                           |
|  Input vector    Weight matrix       Output vector         |
|  (Light          (Transmittance/     (Read by detector)    |
|   intensity)      phase of optical                         |
|                   elements)                                |
|                                                           |
|  [x1]    [ w11 w12 ]    [y1]                              |
|  [x2] →  [ w21 w22 ] →  [y2]                              |
|  [x3]    [ w31 w32 ]    Computed                           |
|   ↑         ↑            instantly via                     |
|  Laser    MZI array      light interference                |
|                                                           |
|  MZI = Mach-Zehnder Interferometer                         |
+-----------------------------------------------------------+
```

### Components of Optical AI Accelerators

```
+-----------------------------------------------------------+
|  Internal Structure of an Optical AI Chip                   |
+-----------------------------------------------------------+
|                                                           |
|  ┌─────────────────────────────────────────────┐          |
|  │              Optical Chip                     │          |
|  │                                               │          |
|  │  ┌──────┐   ┌──────────┐   ┌──────┐         │          |
|  │  │ DAC  │→ │ MZI      │→ │ PD   │→ ADC    │          |
|  │  │Conver-│   │ Mesh     │   │Detec-│  Conver-│          |
|  │  │ter   │   │          │   │tor   │  ter    │          |
|  │  │      │   │Matrix    │   │      │         │          |
|  │  │Elec→ │   │multipli- │   │Light→│         │          |
|  │  │Light │   │cation    │   │Elec  │         │          |
|  │  │      │   │via light │   │      │         │          |
|  │  └──────┘   └──────────┘   └──────┘         │          |
|  │                                               │          |
|  │  DAC = Digital-to-Analog Converter            │          |
|  │  MZI = Mach-Zehnder Interferometer            │          |
|  │  PD  = Photodetector                          │          |
|  │  ADC = Analog-to-Digital Converter            │          |
|  │                                               │          |
|  │  Key startups:                                │          |
|  │  - Lightmatter: Envise (optical accelerator)  │          |
|  │  - Lightelligence: Hummingbird               │          |
|  │  - Luminous Computing: Optical LLM inference  │          |
|  │  - Celestial AI: Photonic Fabric             │          |
|  └─────────────────────────────────────────────┘          |
+-----------------------------------------------------------+
```

### Code Example 4: Optical Neural Network Simulation

```python
import numpy as np

class PhotonicNeuralNetwork:
    """
    Optical neural network simulation
    Implements matrix operations with a Mach-Zehnder Interferometer (MZI) mesh
    """
    def __init__(self, input_dim, output_dim):
        self.input_dim = input_dim
        self.output_dim = output_dim

        # MZI phase parameters (trainable)
        self.theta = np.random.uniform(0, 2*np.pi, (input_dim, output_dim))
        self.phi = np.random.uniform(0, 2*np.pi, (input_dim, output_dim))

    def mzi_transfer(self, theta, phi):
        """Transfer matrix of a Mach-Zehnder Interferometer"""
        return np.array([
            [np.exp(1j*phi) * np.cos(theta/2), -np.sin(theta/2)],
            [np.exp(1j*phi) * np.sin(theta/2),  np.cos(theta/2)]
        ])

    def forward(self, x):
        """
        Matrix operation using light interference
        Electronic circuit: O(n^2) multiplications
        Optical circuit: O(1) — computed instantly at the speed of light
        """
        # Encode input as light amplitude
        optical_input = np.sqrt(np.abs(x)) * np.exp(1j * np.angle(x + 0j))

        # Pass through MZI mesh (equivalent to matrix operation)
        output = np.zeros(self.output_dim, dtype=complex)
        for j in range(self.output_dim):
            for i in range(self.input_dim):
                phase_shift = np.exp(1j * self.theta[i, j])
                output[j] += optical_input[i] * phase_shift

        # Measure intensity with photodetector (complex → real)
        detected = np.abs(output) ** 2

        # Nonlinear activation (realized via electro-optic conversion)
        return self._electro_optic_nonlinearity(detected)

    def _electro_optic_nonlinearity(self, x):
        """Nonlinear transformation via electro-optic modulator"""
        return np.tanh(x)

# Theoretical speed comparison
# 128x128 matrix multiplication:
#   GPU (A100):     ~1 TFLOPS → ~16μs
#   Optical processor: Speed of light → ~0.01μs (1000x faster)
#   Power: GPU ~400W vs Optical ~10W
```

### Code Example 4b: Optical Reservoir Computing

```python
import numpy as np
from scipy.signal import fftconvolve

class PhotonicReservoir:
    """
    Optical reservoir computing
    Uses a random optical system (reservoir) to process time series data

    Principle:
    - Light interference and nonlinear response generate random
      high-dimensional mappings
    - The reservoir itself requires no training (randomly fixed)
    - Only the output layer's linear regression is trained
    - Ultra-fast (speed-of-light processing) + low power consumption
    """
    def __init__(self, input_dim, reservoir_dim, spectral_radius=0.95):
        self.input_dim = input_dim
        self.reservoir_dim = reservoir_dim

        # Input coupling matrix (randomly fixed)
        self.W_in = np.random.randn(reservoir_dim, input_dim) * 0.1

        # Reservoir internal coupling (optically: random MZI mesh configuration)
        W = np.random.randn(reservoir_dim, reservoir_dim)
        # Adjust spectral radius (for stability)
        eigenvalues = np.linalg.eigvals(W)
        W = W * spectral_radius / np.max(np.abs(eigenvalues))
        self.W_res = W

        # Output weights (trainable)
        self.W_out = None

        # Reservoir state
        self.state = np.zeros(reservoir_dim)

    def _optical_nonlinearity(self, x):
        """
        Model of optical nonlinearity
        In real systems, realized via semiconductor optical amplifiers (SOA)
        or self-phase modulation from the Kerr effect
        """
        return np.sin(x) ** 2  # Photodetector square response + interference

    def forward(self, u):
        """Update reservoir state (one step)"""
        # Simulate light propagation
        self.state = self._optical_nonlinearity(
            self.W_res @ self.state + self.W_in @ u
        )
        return self.state

    def fit(self, input_sequence, target_sequence, reg=1e-6):
        """
        Train output layer (ridge regression)
        No training needed for reservoir internals → Extremely fast training
        """
        n_samples = len(input_sequence)
        states = np.zeros((n_samples, self.reservoir_dim))

        # Drive the reservoir
        self.state = np.zeros(self.reservoir_dim)
        for t in range(n_samples):
            states[t] = self.forward(input_sequence[t])

        # Solve for output weights via ridge regression
        R = states.T @ states + reg * np.eye(self.reservoir_dim)
        P = states.T @ target_sequence
        self.W_out = np.linalg.solve(R, P)

        return states @ self.W_out

    def predict(self, input_sequence):
        """Prediction"""
        n_samples = len(input_sequence)
        states = np.zeros((n_samples, self.reservoir_dim))
        for t in range(n_samples):
            states[t] = self.forward(input_sequence[t])

        return states @ self.W_out

# Example: Chaotic time series (Mackey-Glass) prediction
def mackey_glass(n, tau=17, beta=0.2, gamma=0.1, n_init=0.9):
    """Generate Mackey-Glass chaotic time series"""
    x = np.zeros(n + tau)
    x[:tau] = n_init
    for t in range(tau, n + tau):
        x[t] = x[t-1] + beta * x[t-tau] / (1 + x[t-tau]**10) - gamma * x[t-1]
    return x[tau:]

# Data generation
data = mackey_glass(5000)
train_data = data[:4000].reshape(-1, 1)
test_data = data[4000:].reshape(-1, 1)

# Build reservoir
reservoir = PhotonicReservoir(input_dim=1, reservoir_dim=500)

# Train for 1-step-ahead prediction
train_pred = reservoir.fit(train_data[:-1], train_data[1:])
test_pred = reservoir.predict(test_data[:-1])

# Evaluate accuracy
mse = np.mean((test_pred - test_data[1:]) ** 2)
print(f"Test MSE: {mse:.6f}")
# Optical reservoirs demonstrate excellent performance in time series prediction
```

### Optical Interconnects: A Data Center Revolution

```
+-----------------------------------------------------------+
|  Data Center Applications of Optical Interconnects          |
+-----------------------------------------------------------+
|                                                           |
|  Current problem: Communication bottleneck in AI training   |
|                                                           |
|  ┌──────┐  Electrical  ┌──────┐  Electrical  ┌──────┐    |
|  │ GPU 1│←──wiring───→│ GPU 2│←──wiring───→│ GPU 3│    |
|  └──────┘  Bandwidth-  └──────┘  High heat   └──────┘    |
|            limited                                         |
|                                                           |
|  GPT-4 scale training:                                     |
|  - Inter-cluster communication across thousands of GPUs    |
|  - All-Reduce communication consumes 30-50% of training   |
|    time                                                    |
|  - Electrical wiring bandwidth: 400Gbps/link              |
|                                                           |
|  Solution via optical interconnects:                        |
|                                                           |
|  ┌──────┐  Optical fiber ┌──────┐  Optical fiber ┌──────┐|
|  │ GPU 1│←────────────→│ GPU 2│←────────────→│ GPU 3│|
|  └──────┘  1.6Tbps+     └──────┘  Low latency   └──────┘|
|                                                           |
|  Co-Packaged Optics (CPO):                                |
|  - Optical transceivers integrated directly on chip        |
|  - Bandwidth: 1.6Tbps → 3.2Tbps (2027)                   |
|  - Power consumption: Less than 1/5 of electrical          |
|  - Reach: Meters → Kilometers                              |
|                                                           |
|  Key companies:                                            |
|  - Ayar Labs: Optical I/O chiplet                          |
|  - Celestial AI: Photonic Fabric Platform                  |
|  - NVIDIA: NVLink optical interconnect                     |
|  - Broadcom: CPO switch                                    |
+-----------------------------------------------------------+
```

### Comparison of Next-Generation Computing Technologies

| Technology | Maturity | Power | Speed | Main Applications | Estimated Timeline |
|------------|----------|-------|-------|-------------------|-------------------|
| Quantum Computer (NISQ) | Experimental | High (cooling) | Exponentially fast for specific problems | Optimization, molecular design | 2028-2032 |
| Quantum Computer (FT) | Research | High | Cryptanalysis, etc. | General-purpose quantum computing | 2035-2040 |
| Neuromorphic | Early commercialization | Extremely low (mW) | Medium | Edge AI, robots | 2025-2028 |
| Optical Computing | Prototype | Low | Speed of light (matrix ops) | AI inference, communication | 2027-2030 |
| DNA Computing | Basic research | Extremely low | Slow (hours) | Data storage | 2035+ |
| Reversible Computing | Theoretical research | Theoretically zero | Unknown | Extreme energy saving | 2040+ |
| Analog AI Chip | Prototype | Low | Fast (inference) | Edge inference | 2026-2028 |
| 3D Chip Stacking | Early commercialization | Medium | Improved memory bandwidth | HBM, AI training | 2025-2027 |

---

## 4. Quantum x AI Convergence

### Code Example 5: Variational Quantum Eigensolver (VQE)

```python
from qiskit.primitives import Estimator
from qiskit.circuit.library import TwoLocal
from qiskit_algorithms import VQE
from qiskit_algorithms.optimizers import SPSA
from qiskit_nature.second_q.drivers import PySCFDriver
from qiskit_nature.second_q.mappers import JordanWignerMapper

# Energy calculation of the hydrogen molecule (H2)
driver = PySCFDriver(atom="H 0 0 0; H 0 0 0.735", basis="sto-3g")
problem = driver.run()

# Mapping to qubits
mapper = JordanWignerMapper()
qubit_op = mapper.map(problem.second_q_ops()[0])

# Variational circuit (trial wavefunction)
ansatz = TwoLocal(
    num_qubits=qubit_op.num_qubits,
    rotation_blocks=['ry', 'rz'],
    entanglement_blocks='cz',
    reps=2,
)

# Execute VQE
estimator = Estimator()
optimizer = SPSA(maxiter=200)

vqe = VQE(estimator, ansatz, optimizer)
result = vqe.compute_minimum_eigenvalue(qubit_op)

print(f"H2 ground state energy: {result.eigenvalue:.6f} Ha")
print(f"Exact solution: -1.137275 Ha")
# Computing chemically accurate energies with a quantum computer
```

### Code Example 5b: Quantum Approximate Optimization Algorithm (QAOA)

```python
from qiskit import QuantumCircuit
from qiskit.circuit import Parameter
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import Sampler
from qiskit.quantum_info import SparsePauliOp
import numpy as np

def create_maxcut_hamiltonian(edges: list, num_nodes: int) -> SparsePauliOp:
    """
    Build the Hamiltonian for the MaxCut problem
    MaxCut: Partition graph nodes into 2 groups to maximize
            the number of edges between groups — an NP-hard problem

    Applications in logistics, scheduling, VLSI design, etc.
    """
    pauli_list = []
    coeffs = []

    for i, j in edges:
        # For each edge: 0.5 * (I - Z_i * Z_j) term
        # Energy is lower when Z_i and Z_j differ (cut edge)
        z_str = ['I'] * num_nodes
        z_str[i] = 'Z'
        z_str[j] = 'Z'
        pauli_list.append(''.join(z_str))
        coeffs.append(-0.5)

        # Constant term
        pauli_list.append('I' * num_nodes)
        coeffs.append(0.5)

    return SparsePauliOp(pauli_list, coeffs).simplify()

# Define MaxCut problem (5-node graph)
edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 0), (0, 2)]
num_nodes = 5

hamiltonian = create_maxcut_hamiltonian(edges, num_nodes)

# Execute QAOA
sampler = Sampler()
optimizer = COBYLA(maxiter=300)

qaoa = QAOA(
    sampler=sampler,
    optimizer=optimizer,
    reps=3,           # Number of QAOA layers (p value)
    initial_point=np.random.uniform(-np.pi, np.pi, 6),
)

result = qaoa.compute_minimum_eigenvalue(hamiltonian)

# Analyze optimal solution
best_bitstring = max(result.eigenstate, key=result.eigenstate.get)
print(f"Optimal cut: {best_bitstring}")
print(f"Number of cut edges: {-result.eigenvalue:.0f}")

# Comparison with classical brute-force search
# 5 nodes: 2^5 = 32 possibilities → Classical is fast enough
# 100 nodes: 2^100 possibilities → Practically impossible classically
# QAOA advantage: Potentially finds approximate solutions in polynomial time
```

### Code Example 5c: Quantum Neural Network with PennyLane

```python
import pennylane as qml
from pennylane import numpy as np

# Quantum device setup
n_qubits = 4
dev = qml.device("default.qubit", wires=n_qubits)

@qml.qnode(dev)
def quantum_neural_net(inputs, weights):
    """
    Quantum Neural Network (QNN)
    Classifier using a parameterized quantum circuit

    Classical → Quantum → Classical hybrid architecture
    """
    # Data encoding (angle encoding)
    for i in range(n_qubits):
        qml.RX(inputs[i], wires=i)

    # Variational layers (trainable parameters)
    for layer in range(len(weights)):
        # Rotation gates
        for i in range(n_qubits):
            qml.RY(weights[layer][i][0], wires=i)
            qml.RZ(weights[layer][i][1], wires=i)

        # Entanglement layer (ring connectivity)
        for i in range(n_qubits):
            qml.CNOT(wires=[i, (i + 1) % n_qubits])

    # Measurement (expectation values)
    return [qml.expval(qml.PauliZ(i)) for i in range(n_qubits)]

def hybrid_classifier(inputs, weights, classical_weights, bias):
    """
    Hybrid quantum-classical classifier
    Post-process quantum circuit output with a classical layer
    """
    # Quantum processing
    q_output = np.array(quantum_neural_net(inputs, weights))

    # Classical post-processing (linear layer + sigmoid)
    logit = np.dot(classical_weights, q_output) + bias
    return 1 / (1 + np.exp(-logit))  # Sigmoid

# Parameter initialization
n_layers = 3
weights = np.random.randn(n_layers, n_qubits, 2, requires_grad=True) * 0.1
classical_weights = np.random.randn(n_qubits, requires_grad=True) * 0.1
bias = np.array(0.0, requires_grad=True)

# Training loop
optimizer = qml.GradientDescentOptimizer(stepsize=0.1)

for epoch in range(100):
    total_loss = 0
    for x, y in zip(X_train, y_train):
        # Loss function (binary cross-entropy)
        def cost(w, cw, b):
            pred = hybrid_classifier(x, w, cw, b)
            return -(y * np.log(pred + 1e-8) + (1-y) * np.log(1-pred + 1e-8))

        weights, classical_weights, bias = optimizer.step(
            cost, weights, classical_weights, bias
        )
        total_loss += cost(weights, classical_weights, bias)

    if epoch % 10 == 0:
        print(f"Epoch {epoch}: Loss = {total_loss / len(X_train):.4f}")

# PennyLane advantages:
# - Supports automatic differentiation (parameter-shift rule)
# - Integration with PyTorch, TensorFlow
# - Can execute on real hardware (IBM, IonQ, Rigetti)
# - Noise model simulation
```

### How to Access Quantum Computers

```python
"""
Currently available quantum computer cloud services

How engineers can actually try quantum computers
"""

# 1. IBM Quantum (free tier available)
# pip install qiskit qiskit-ibm-runtime
from qiskit_ibm_runtime import QiskitRuntimeService

service = QiskitRuntimeService(channel="ibm_quantum")
# List available backends
backends = service.backends()
for b in backends:
    print(f"{b.name}: {b.num_qubits} qubits, "
          f"status={'available' if b.status().operational else 'maintenance'}")

# 2. Amazon Braket
# pip install amazon-braket-sdk
"""
from braket.aws import AwsDevice
from braket.circuits import Circuit

# Use IonQ quantum computer
device = AwsDevice("arn:aws:braket:us-east-1::device/qpu/ionq/Aria-1")

circuit = Circuit()
circuit.h(0).cnot(0, 1)

task = device.run(circuit, shots=1000)
result = task.result()
print(result.measurement_counts)
# Pricing: $0.01 per shot + $0.30 per task (IonQ)
"""

# 3. Google Quantum AI
# pip install cirq
"""
import cirq
import cirq_google

# Use Google's quantum processor
processor = cirq_google.get_engine().get_processor('rainbow')
qubits = cirq.GridQubit.rect(1, 2)

circuit = cirq.Circuit(
    cirq.H(qubits[0]),
    cirq.CNOT(qubits[0], qubits[1]),
    cirq.measure(*qubits, key='result'),
)

result = processor.run(circuit, repetitions=1000)
"""

# 4. Azure Quantum
"""
from azure.quantum import Workspace
from azure.quantum.cirq import AzureQuantumService

workspace = Workspace(
    resource_id="/subscriptions/.../quantumWorkspaces/my-workspace",
    location="eastus",
)

# Quantinuum H1 quantum computer
service = AzureQuantumService(workspace=workspace)
# Pricing: HQC (Hardware Quantum Credits) units
"""

# Comparison of services
cloud_comparison = {
    "IBM Quantum": {
        "Qubits": "127 (Eagle) / 1121 (Condor)",
        "Type": "Superconducting",
        "Free tier": "Available (10 min/month)",
        "Pricing": "Pay-as-you-go ($1.60/sec)",
        "SDK": "Qiskit",
    },
    "Amazon Braket": {
        "Qubits": "IonQ 25, Rigetti 80+",
        "Type": "Ion trap / Superconducting (selectable)",
        "Free tier": "$100 equivalent (new users)",
        "Pricing": "Per-shot billing",
        "SDK": "Braket SDK",
    },
    "Google Quantum AI": {
        "Qubits": "105 (Willow)",
        "Type": "Superconducting",
        "Free tier": "Application-based for researchers",
        "Pricing": "Application-based",
        "SDK": "Cirq",
    },
    "Azure Quantum": {
        "Qubits": "Quantinuum H2 56",
        "Type": "Ion trap and others",
        "Free tier": "$500 equivalent (new users)",
        "Pricing": "HQC units",
        "SDK": "Q# / Cirq / Qiskit",
    },
}
```

---

## 5. DNA Computing

### Principles and Potential of DNA Storage

```
+-----------------------------------------------------------+
|  How DNA Data Storage Works                                 |
+-----------------------------------------------------------+
|                                                           |
|  Digital data → DNA sequence → Storage → Readout → Digital |
|                                                           |
|  Encoding:                                                 |
|  ┌───────────────────────────────────┐                    |
|  │  Binary     DNA Base              │                    |
|  │  00    →    A (Adenine)           │                    |
|  │  01    →    T (Thymine)           │                    |
|  │  10    →    G (Guanine)           │                    |
|  │  11    →    C (Cytosine)          │                    |
|  │                                   │                    |
|  │  "Hello" = 01001000 01100101 ...  │                    |
|  │         → TGAA TCGT ...           │                    |
|  └───────────────────────────────────┘                    |
|                                                           |
|  Data density comparison:                                   |
|  ┌───────────────────────────────────┐                    |
|  │  HDD:     ~1 TB / 100 cm³         │                    |
|  │  SSD:     ~8 TB / 100 cm³         │                    |
|  │  DNA:   ~215 PB / 1 g             │                    |
|  │         (= 215,000 TB!)           │                    |
|  │                                   │                    |
|  │  All the world's data (~120 ZB)   │                    |
|  │  stored in DNA → About 1 kg       │                    |
|  └───────────────────────────────────┘                    |
|                                                           |
|  Storage lifespan:                                          |
|  HDD: 3-5 years, SSD: 5-10 years                          |
|  DNA: Thousands to hundreds of thousands of years           |
|  (under proper storage conditions)                          |
|  - 2015: Successfully read DNA from a 700,000-year-old     |
|    mammoth                                                  |
+-----------------------------------------------------------+
```

### Code Example 6: DNA Storage Encoding/Decoding

```python
import random
from typing import List, Tuple

class DNAStorage:
    """
    DNA data storage encoding/decoding simulation

    In real systems, the following additional processing is needed:
    - Error correction codes (Reed-Solomon, etc.)
    - GC content equalization (40-60%)
    - Homopolymer avoidance (avoiding runs like AAAA)
    - Address assignment for random access
    """

    # 2 bits → 1 base mapping
    ENCODE_MAP = {'00': 'A', '01': 'T', '10': 'G', '11': 'C'}
    DECODE_MAP = {v: k for k, v in ENCODE_MAP.items()}

    def encode(self, data: bytes) -> str:
        """Encode binary data to DNA base sequence"""
        binary = ''.join(format(byte, '08b') for byte in data)

        # Pad if odd length
        if len(binary) % 2 != 0:
            binary += '0'

        # Convert 2 bits at a time to DNA bases
        dna = ''
        for i in range(0, len(binary), 2):
            dna += self.ENCODE_MAP[binary[i:i+2]]

        return dna

    def decode(self, dna: str) -> bytes:
        """Decode DNA base sequence to binary data"""
        binary = ''
        for base in dna:
            binary += self.DECODE_MAP[base]

        # Convert 8 bits at a time to bytes
        data = bytearray()
        for i in range(0, len(binary) - len(binary) % 8, 8):
            data.append(int(binary[i:i+8], 2))

        return bytes(data)

    def add_error_correction(self, dna: str, redundancy: int = 3) -> List[str]:
        """
        Error correction through redundancy
        Encode the same data into multiple DNA fragments
        """
        fragment_len = 200  # Typical DNA synthesis length limit
        fragments = []

        for i in range(0, len(dna), fragment_len):
            fragment = dna[i:i + fragment_len]
            # Replicate each fragment 'redundancy' times
            for r in range(redundancy):
                # Attach address (position information)
                address = format(i // fragment_len, '016b')
                address_dna = ''.join(
                    self.ENCODE_MAP[address[j:j+2]]
                    for j in range(0, 16, 2)
                )
                fragments.append(address_dna + fragment)

        return fragments

    def simulate_sequencing_errors(self, dna: str,
                                    substitution_rate: float = 0.01,
                                    insertion_rate: float = 0.005,
                                    deletion_rate: float = 0.005) -> str:
        """Simulate sequencing errors"""
        result = []
        bases = ['A', 'T', 'G', 'C']

        for base in dna:
            r = random.random()
            if r < deletion_rate:
                continue  # Deletion
            elif r < deletion_rate + insertion_rate:
                result.append(random.choice(bases))  # Insertion
                result.append(base)
            elif r < deletion_rate + insertion_rate + substitution_rate:
                result.append(random.choice([b for b in bases if b != base]))  # Substitution
            else:
                result.append(base)

        return ''.join(result)

# Example usage
storage = DNAStorage()

# Encode text data
message = "Hello, DNA Storage!"
encoded = storage.encode(message.encode('utf-8'))
print(f"Original data: {message}")
print(f"Data size: {len(message)} bytes")
print(f"DNA sequence: {encoded[:50]}...")
print(f"DNA sequence length: {len(encoded)} bases")

# Decode
decoded = storage.decode(encoded)
print(f"Recovered data: {decoded.decode('utf-8')}")

# Generate fragments with error correction
fragments = storage.add_error_correction(encoded)
print(f"Number of fragments: {len(fragments)}")

# Cost comparison (approximate as of 2025)
cost_comparison = {
    "DNA synthesis (write)": "$0.01-0.10 / base",
    "DNA synthesis cost/MB": "~$3,500",
    "DNA sequencing (read)": "$0.001 / base",
    "Read cost/MB": "~$350",
    "HDD cost/MB": "$0.00002",
    "Tape storage/MB": "$0.00001",
    "Break-even point": "Data stored for 50+ years",
}
```

---

## 6. Reversible Computing

### Landauer's Principle and Reversible Computation

```
+-----------------------------------------------------------+
|  Landauer's Principle and Reversible Computing              |
+-----------------------------------------------------------+
|                                                           |
|  Landauer's Principle (1961):                               |
|  "Irreversibly erasing information releases a minimum       |
|   of kT ln2 energy as heat"                                |
|                                                           |
|  k = Boltzmann constant = 1.38×10⁻²³ J/K                  |
|  T = Temperature (K)                                       |
|  Landauer limit at room temperature (300K):                 |
|  kT ln2 ≈ 2.87 × 10⁻²¹ J / bit erasure                   |
|                                                           |
|  Current processors:                                        |
|  ~10⁻¹⁵ J / bit operation (1 million times the Landauer    |
|  limit)                                                    |
|                                                           |
|  Irreversible gate (AND):    Reversible gate (Toffoli):    |
|  A B → A AND B               A B C → A B (C XOR AB)       |
|  0 0 → 0                    3 inputs → 3 outputs          |
|  0 1 → 0   ← Input cannot   No information lost           |
|  1 0 → 0     be recovered   Theoretically zero energy     |
|  1 1 → 1                    consumption                    |
|                                                           |
|  Significance of reversible computing:                      |
|  - Theoretically can achieve zero energy consumption        |
|  - Quantum computers are inherently reversible (unitary     |
|    transformations)                                         |
|  - Ultimate solution to the power consumption problem of    |
|    ultra-large-scale AI                                     |
+-----------------------------------------------------------+
```

### Code Example 7: Simulation of Reversible Logic Gates

```python
import numpy as np

class ReversibleGates:
    """
    Simulation of reversible logic gates
    All classical computations can be realized with combinations
    of reversible gates
    """

    @staticmethod
    def toffoli(a: int, b: int, c: int) -> tuple:
        """
        Toffoli gate (CCNOT gate)
        3-input, 3-output reversible gate
        c' = c XOR (a AND b)
        a, b remain unchanged
        Any classical computation can be constructed with Toffoli gates alone
        """
        return (a, b, c ^ (a & b))

    @staticmethod
    def fredkin(a: int, b: int, c: int) -> tuple:
        """
        Fredkin gate (CSWAP gate)
        Swaps b and c when a is 1
        Does nothing when a is 0
        """
        if a == 1:
            return (a, c, b)
        return (a, b, c)

    @staticmethod
    def reversible_and(a: int, b: int) -> tuple:
        """Implement AND with Toffoli gate (ancilla bit = 0)"""
        return ReversibleGates.toffoli(a, b, 0)  # (a, b, a AND b)

    @staticmethod
    def reversible_or(a: int, b: int) -> tuple:
        """Reversible OR gate"""
        # OR = NOT(NOT(a) AND NOT(b))
        # Implemented with Toffoli + NOT
        na, nb = 1 - a, 1 - b
        _, _, nand = ReversibleGates.toffoli(na, nb, 0)
        return (a, b, 1 - nand)

    @staticmethod
    def reversible_full_adder(a: int, b: int, cin: int) -> tuple:
        """
        Reversible full adder
        sum = a XOR b XOR cin
        cout = (a AND b) OR (cin AND (a XOR b))

        Input and output have the same number of bits → No information loss
        """
        # Intermediate results
        p = a ^ b           # Half adder sum
        g = a & b           # Half adder carry
        s = p ^ cin          # Full adder sum
        cout = g | (p & cin) # Full adder carry

        # Preserve information with ancilla bits
        return (a, b, cin, s, cout)

# Verification
gates = ReversibleGates()

print("Toffoli gate truth table:")
for a in [0, 1]:
    for b in [0, 1]:
        for c in [0, 1]:
            result = gates.toffoli(a, b, c)
            print(f"  ({a}, {b}, {c}) → {result}")

print("\nReversible full adder:")
for a in [0, 1]:
    for b in [0, 1]:
        for cin in [0, 1]:
            result = gates.reversible_full_adder(a, b, cin)
            print(f"  {a}+{b}+{cin} → sum={result[3]}, cout={result[4]}")

# Theoretical energy efficiency comparison
print("\n--- Energy Efficiency Comparison ---")
print(f"Landauer limit (300K): {1.38e-23 * 300 * 0.693:.2e} J/bit")
print(f"Current CPU (~5nm):    ~{1e-15:.2e} J/bit operation")
print(f"Efficiency ratio:      {1e-15 / (1.38e-23 * 300 * 0.693):.0f}x gap")
print(f"Reversible computing:  Theoretically 0 J/bit")
```

---

## 7. Analog AI Chips

### AI Inference with In-Memory Computing

```
+-----------------------------------------------------------+
|  Analog In-Memory Computing (IMC)                          |
+-----------------------------------------------------------+
|                                                           |
|  Principle: Matrix multiplication via physical laws of      |
|  resistors                                                  |
|                                                           |
|  V (voltage) = Input vector                                |
|  G (conductance) = Weight matrix                           |
|  I (current) = V × G  ← Automatically computed by         |
|                          Ohm's law                          |
|                                                           |
|  ┌──────────────────────────────────┐                     |
|  │  V1 ──┤G11├──┬──┤G12├──┬──      │                     |
|  │       │      │  │      │         │                     |
|  │  V2 ──┤G21├──┤──┤G22├──┤──      │                     |
|  │       │      │  │      │         │                     |
|  │  V3 ──┤G31├──┤──┤G32├──┤──      │                     |
|  │              │         │         │                     |
|  │        I1=ΣViGi1  I2=ΣViGi2    │                     |
|  │                                  │                     |
|  │  Matrix multiplication completes │                     |
|  │  in 1 clock cycle                │                     |
|  │  (Digital requires O(n²) clocks) │                     |
|  └──────────────────────────────────┘                     |
|                                                           |
|  Use of Memristors:                                        |
|  - Retain resistance values in analog form                  |
|  - Resistance value = Neural network weight                 |
|  - Read (inference) = Just apply voltage                    |
|  - Write (training) = Change resistance with pulse voltage  |
|                                                           |
|  Key companies:                                            |
|  - IBM: Hermes (14nm analog AI chip)                       |
|  - Mythic: M1076 (analog AI accelerator)                   |
|  - Rain AI: NPU (neuromorphic + analog)                    |
|  - Syntiant: NDP (ultra-low-power voice AI)                |
+-----------------------------------------------------------+
```

### Code Example 8: Analog Matrix Multiplication Simulation

```python
import numpy as np

class AnalogIMCSimulator:
    """
    Analog In-Memory Computing simulation
    Simulates matrix multiplication on a memristor crossbar array
    """

    def __init__(self, rows: int, cols: int,
                 conductance_range: tuple = (1e-6, 1e-4),
                 adc_bits: int = 8,
                 noise_std: float = 0.02):
        """
        Parameters
        ----------
        rows : int
            Input dimension (number of rows)
        cols : int
            Output dimension (number of columns)
        conductance_range : tuple
            Min/max conductance values (S)
        adc_bits : int
            ADC bit count (quantization precision)
        noise_std : float
            Device noise standard deviation
        """
        self.rows = rows
        self.cols = cols
        self.g_min, self.g_max = conductance_range
        self.adc_bits = adc_bits
        self.noise_std = noise_std

        # Conductance matrix (corresponds to weights)
        self.G = None

    def program_weights(self, weights: np.ndarray):
        """
        Map neural network weights to conductance values
        Weight range [-1, 1] → Conductance [g_min, g_max]

        Differential pair method: Represent positive and negative weights
        with separate memristors
        W = G+ - G-
        """
        # Normalize weights to [0, 1]
        w_normalized = (weights + 1) / 2

        # Map to conductance
        self.G_pos = self.g_min + w_normalized * (self.g_max - self.g_min)
        self.G_neg = self.g_min + (1 - w_normalized) * (self.g_max - self.g_min)

    def compute(self, input_voltages: np.ndarray) -> np.ndarray:
        """
        Execute analog matrix multiplication

        Physical process:
        1. Apply input voltages to row lines (word lines)
        2. Current through memristors: I = V × G (Ohm's law)
        3. Aggregate current on column lines (bit lines):
           I_col = Σ(V_i × G_ij)
        4. Convert to digital values with ADC

        Computation time: O(1) — all multiplications execute simultaneously
        """
        # Current calculation (ideal)
        I_pos = input_voltages @ self.G_pos
        I_neg = input_voltages @ self.G_neg

        # Differential output
        I_diff = I_pos - I_neg

        # Add device noise (real hardware imperfections)
        noise = np.random.normal(0, self.noise_std * np.abs(I_diff))
        I_noisy = I_diff + noise

        # ADC quantization
        output = self._adc_quantize(I_noisy)

        return output

    def _adc_quantize(self, analog_signal: np.ndarray) -> np.ndarray:
        """Quantization by ADC (precision according to bit count)"""
        levels = 2 ** self.adc_bits
        sig_range = np.max(np.abs(analog_signal)) + 1e-10
        quantized = np.round(analog_signal / sig_range * (levels / 2))
        return quantized / (levels / 2) * sig_range

# Example: 128-dimensional matrix multiplication
imc = AnalogIMCSimulator(rows=128, cols=64, adc_bits=8)

# Program random weights
weights = np.random.randn(128, 64) * 0.1
imc.program_weights(weights)

# Input data
input_data = np.random.randn(128) * 0.5

# Analog computation
analog_result = imc.compute(input_data)

# Digital computation (for comparison)
digital_result = input_data @ weights

# Accuracy comparison
error = np.mean(np.abs(analog_result - digital_result) / (np.abs(digital_result) + 1e-10))
print(f"Mean relative error: {error:.4%}")
# → With 8-bit ADC, 1-2% error (sufficient precision for AI inference)

# Energy efficiency
print("\n--- Energy Efficiency Comparison (128×64 matrix multiplication) ---")
print(f"GPU (A100):       ~{128*64*2 / 1e12 * 1e6:.2f} μJ  (FP16)")
print(f"Analog IMC:       ~{128*64*0.1e-15 * 1e6:.4f} μJ  (Analog)")
print(f"Efficiency ratio: ~{128*64*2 / 1e12 / (128*64*0.1e-15):.0f}x")
```

---

## 8. Roadmap

### Timeline for Next-Generation Computing

```
2025        2028        2030        2035        2040
  |           |           |           |           |
  v           v           v           v           v

Quantum: NISQ → Error correction → Logical qubits → Practical advantage → General-purpose
         1000+ physical → Lower error → 100+ logical → Crypto/Drug      → Shor practical
         qubits           rates         qubits         discovery apps

Neuro-   Loihi 2  → Commercial  → Edge standard → Autonomous    → General intelligence
morphic:            chips spread                    robot brains    hardware

Optical: Proto-  → Early       → AI inference   → Opto-       → Optical quantum
         types     commercial    standard option   electronic     computer
                   (inference)                     hybrid

DNA:     Basic   → Cost        → Archive        → General     → In-vivo
         research  reduction     storage           purpose       computer
                   write $0.001/b                  storage

Analog:  → Edge    → Data center → Training-    → Hybrid
IMC:     Early     inference      capable IMC     SoC standard
         commercial accelerator
         ization

3D       → HBM4    → Chiplet     → Heterogeneous → Molecular-level
Stacking:  HBM3e     standardized   integration     3D integration
                                    SoC
```

### What Engineers Can Start Doing Now

```python
"""
Skill development roadmap for next-generation hardware
"""

preparation_roadmap = {
    "2025-2026 (Start now)": {
        "Quantum": [
            "Complete Qiskit / Cirq / PennyLane tutorials",
            "Try real hardware on IBM Quantum's free tier",
            "Review linear algebra and quantum mechanics basics",
            "Read one introductory book on quantum algorithms",
        ],
        "Neuromorphic": [
            "Implement spiking NNs with snnTorch",
            "Work through Intel Lava framework tutorials",
            "Experiment with event camera datasets (N-MNIST, etc.)",
        ],
        "Optical Computing": [
            "Try optical simulations (Photontorch, etc.)",
            "Monitor optical interconnect developments",
        ],
        "General": [
            "Review linear algebra (matrix decomposition, eigenvalue problems)",
            "Study fundamentals of information theory (entropy, coding)",
            "Understand low-bit quantization and sparse computation",
        ],
    },
    "2027-2028 (Preparation period)": {
        "Quantum": [
            "Attempt real-problem solving with QAOA/VQE",
            "Develop PQC (Post-Quantum Cryptography) migration plans",
            "Benchmark on quantum cloud services",
        ],
        "Neuromorphic": [
            "Consider SNN adoption for edge AI projects",
            "Apply to IoT devices with power consumption constraints",
        ],
        "Optical": [
            "Participate in optical AI accelerator benchmarks",
            "Consider optical interconnect deployment in data centers",
        ],
    },
    "2030+ (Production period)": {
        "Goals": [
            "Implement quantum-classical hybrid applications",
            "Deploy neuromorphic chips in production",
            "Optimize AI inference with optical computing",
            "Design software optimized for next-generation architectures",
        ],
    },
}

# Decision criteria: When should you adopt next-generation hardware?
adoption_criteria = {
    "Cases to consider quantum computers": [
        "Classical approach cannot solve combinatorial optimization in practical time",
        "Molecular simulation accuracy is insufficient",
        "Long-term cryptographic security planning is needed",
        "R&D budget is available (commercial use is still limited)",
    ],
    "Cases to consider neuromorphic": [
        "Power consumption constraint below 10mW",
        "Always-on anomaly detection or sensor processing is needed",
        "AI inference on battery-powered devices",
        "Integration with event cameras (robots, autonomous driving)",
    ],
    "Cases to consider optical computing": [
        "Data center power cost is a major concern",
        "Low-latency large-scale AI inference is needed",
        "GPU-to-GPU communication is a bottleneck",
        "Planning future capital investments",
    ],
    "Cases where classical computers are still sufficient": [
        "General web application development",
        "Standard machine learning / deep learning tasks",
        "Database operations, CRUD operations",
        "95%+ of software engineering tasks",
    ],
}
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Quantum Computer Omnipotence Myth

```
BAD: "Quantum computers speed up everything"
     → Problems with quantum advantage are limited

GOOD: Understand which problems quantum computers are effective for
      Effective: Factorization, quantum simulation, specific optimization problems
      Ineffective: General data processing, web servers, spreadsheet calculations,
                   sorting, search (Grover offers only quadratic speedup)
      Note: Current NISQ devices have large quantum errors, and the
            problems that demonstrate practical advantage are still limited
```

### Anti-Pattern 2: Overestimating Practical Timeline

```
BAD: "Quantum computers will break encryption within 5 years"
     → Cracking RSA-2048 requires ~4 million physical qubits
     → Currently at ~1,000 physical qubits, error rate still high

GOOD: Realistic expectations
      2025-2028: Limited demonstrations on NISQ (quantum chemistry,
                 small-scale optimization)
      2028-2032: Error correction improves, practical advantage in
                 specific domains
      2032-2040: Medium-scale fault-tolerant quantum computation
      2040+:     Large-scale quantum computation at encryption-breaking level
```

### Anti-Pattern 3: Premature Migration to Next-Generation Hardware

```
BAD: "Neuromorphic chips are coming, so let's stop investing in GPUs"
     → GPUs will remain the primary AI hardware at least through the 2030s
     → NVIDIA's market dominance will continue for some time

GOOD: Gradual evaluation and preparation
      1. Optimize current GPU/TPU infrastructure while
      2. Running PoCs (proof of concepts) for next-gen technologies in parallel
      3. Gradually adopt when clear advantages emerge for specific use cases
      4. Design hardware abstraction layers to make switching easier
```

### Anti-Pattern 4: Judging Solely by Hardware Performance

```
BAD: "Optical computers are 1000x faster, so we should adopt them immediately"
     → Software ecosystem, debugging tools, and talent are lacking
     → No production track record

GOOD: Comprehensive evaluation criteria
      ┌─────────────────────────────────────┐
      │  5 Evaluation Axes for Technology    │
      │  Selection                           │
      │  1. Performance (speed, accuracy,    │
      │     throughput)                      │
      │  2. Cost (initial, operational,      │
      │     power)                           │
      │  3. Ecosystem (SDK, tools, talent)   │
      │  4. Maturity (production track       │
      │     record, reliability)             │
      │  5. Future potential (roadmap,       │
      │     community)                       │
      └─────────────────────────────────────┘
```

---

## FAQ

### Q1. Will quantum computers replace classical computers?

They will complement, not replace. Quantum computers vastly outperform classical ones for specific problems (optimization, molecular simulation, cryptography), but classical computers are better suited for general computation (databases, web servers, office software). In the future, HPC + quantum hybrid architectures will become mainstream.

### Q2. What are practical use cases for neuromorphic chips?

Always-on sensor processing (voice wake-word detection, anomaly detection), low-latency reflex behavior in robots, and ultra-low-power AI inference on edge devices are promising. BrainChip's Akida is already deployed in smart cameras and industrial IoT. It enables AI inference at 1/1000th the power consumption of GPUs.

### Q3. Can optical computing handle AI training?

Currently it specializes in inference (matrix operations). Backpropagation needed for training is difficult in optical systems, and electro-optical hybrid approaches are being researched. Startups like Lightelligence and Lightmatter are developing optical AI inference chips, with high expectations for reducing data center power consumption.

### Q4. When will DNA storage become practical?

Initial deployment for archive purposes (cold data not frequently accessed) is expected around 2030. Write cost is the biggest barrier -- as of 2025, it costs several thousand dollars per MB. However, advances in DNA synthesis technology could bring this down to several dollars per MB by 2030. Read costs have already become quite realistic thanks to advances in nanopore sequencing technology.

### Q5. What should today's software engineers prepare?

The top priority is "migration planning for quantum-resistant cryptography." If you operate systems that use cryptography, you should start planning migration to NIST-standardized post-quantum cryptographic algorithms now. Next is "hardware abstraction design." Adopt design patterns that decouple computation from hardware so you can accommodate future hardware changes. Quantum programming itself is currently aimed at researchers and specialists; the urgency for general software engineers to learn it now is low.

### Q6. Is quantum computer programming difficult?

Frameworks like Qiskit, Cirq, and PennyLane allow you to write quantum circuits in Python. Designing quantum algorithms themselves requires understanding of quantum mechanics, but if you're just using existing algorithms (Grover, VQE, QAOA, etc.), knowledge of linear algebra is sufficient to work through tutorials. However, developing practical quantum programs requires additional skills such as understanding quantum errors, circuit optimization (transpilation), and noise modeling.

### Q7. How will computing power improve after the end of Moore's Law?

Performance gains from transistor miniaturization (Moore's Law) are approaching physical limits, but computing power will continue to improve. Key directions include: (1) Efficiency gains through specialized architectures (GPU, TPU, NPU), (2) Increased integration through 3D chip stacking, (3) New computing paradigms (quantum, neuromorphic, optical), (4) Software optimization (quantization, distillation, sparsification). Especially in the AI field, the combination of hardware specialization and algorithmic efficiency improvements is expected to continue driving effective exponential growth in computing power.

---

## Summary

| Concept | Key Point |
|---------|-----------|
| Qubit | A unit of quantum information that takes superposition states of 0 and 1 |
| NISQ | The current era of medium-scale noisy quantum devices |
| Quantum Gate | Basic operation that manipulates qubits |
| VQE/QAOA | Variational quantum algorithms for the NISQ era |
| Grover Search | Quadratic speedup for unsorted database search |
| Quantum Error Correction | Constructing logical qubits from physical qubits |
| Post-Quantum Cryptography | Cryptographic methods resistant to quantum computers |
| Neuromorphic | Brain-inspired event-driven computing chips |
| SNN | Spiking Neural Network |
| Lava | Intel's neuromorphic development framework |
| Optical Computing | Matrix operations at the speed of light via light interference |
| MZI | Mach-Zehnder Interferometer (basic element of optical circuits) |
| Optical Reservoir | Time series processing using random optical system responses |
| DNA Storage | Ultra-high-density, ultra-long-term data storage technology |
| Reversible Computing | Minimizing energy consumption by preserving information |
| Analog IMC | Analog matrix multiplication with memristors |
| Landauer Limit | Minimum energy required to erase information |

---

## Recommended Next Guides

- **01-computing/01-gpu-computing.md** — GPU: NVIDIA/AMD, CUDA (current mainstream)
- **01-computing/03-cloud-ai-hardware.md** — Cloud AI Hardware: TPU, Inferentia
- **02-emerging/00-ar-vr-ai.md** — AR/VR x AI: Spatial Computing

---

## References

1. **IBM Quantum — Qiskit Textbook** https://qiskit.org/learn/
2. **Intel — Loihi 2 Neuromorphic Chip** https://www.intel.com/content/www/us/en/research/neuromorphic-computing.html
3. **Nature — Photonic Computing Review** https://www.nature.com/articles/s41566-021-00927-7
4. **Google Quantum AI** https://quantumai.google/
5. **BrainChip — Akida** https://brainchip.com/
6. **PennyLane — Quantum Machine Learning** https://pennylane.ai/
7. **Intel Lava — Neuromorphic Framework** https://lava-nc.org/
8. **Microsoft — Topological Qubits** https://quantum.microsoft.com/
9. **NIST — Post-Quantum Cryptography** https://csrc.nist.gov/projects/post-quantum-cryptography
10. **Lightmatter — Photonic AI** https://lightmatter.co/
11. **DNA Data Storage Alliance** https://dnastoragealliance.org/
