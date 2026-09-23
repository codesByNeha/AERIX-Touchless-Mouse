\# AERIX – Touchless Mouse Control System



\*\*AERIX\*\* is an AI-powered Human-Computer Interaction (HCI) system that enables hands-free computer control using real-time hand gestures captured through a webcam. It combines computer vision, gesture recognition, a futuristic \*\*Three.js 3D interface with an interactive 3D mouse cursor\*\*, and intelligent URL safety.



\##  Key Features



\*  Real-time hand gesture-based mouse control

\*  Cursor movement, left/right click, double-click, scrolling and drag-and-drop

\*  Interactive \*\*Three.js 3D frontend\*\*

\*  \*\*3D mouse replacing the traditional cursor\*\*

\*  Gesture calibration, sensitivity and system settings

\*  FastAPI backend with WebSocket communication

\*  ML-based URL classification and phishing protection

\*  Threat intelligence using PhishTank and optional VirusTotal

\*  Chrome/Edge extension for link safety

\*  Webcam-based hand tracking using MediaPipe

\*  Minimal hardware requirements



\##  Technologies



\*\*Backend:\*\* Python, FastAPI, OpenCV, PyAutoGUI

\*\*Computer Vision:\*\* MediaPipe Tasks Hand Landmarker

\*\*Machine Learning:\*\* Scikit-learn

\*\*Frontend:\*\* HTML, CSS, JavaScript, Three.js

\*\*Browser Security:\*\* Chrome Manifest V3 Extension

\*\*Threat Intelligence:\*\* PhishTank, VirusTotal

\*\*Containerization:\*\* Docker



\##  Project Structure



```text

TouchlessMouse\_

│

├── Mouse\_updated (1)/

│   └── Mouse\_extracted/

│       ├── Aeris/              # 3D frontend

│       ├── backend/             # FastAPI + gesture + security logic

│       ├── browser\_extension/   # Chrome/Edge security extension

│       ├── models/              # MediaPipe model

│       └── requirements.txt

│

├── TouchlessMouseProject (updatedzip)/

│   └── TouchlessMouseProject/

│       └── frontend/            # Additional frontend project

│

├── docker-compose.yml

├── start\_touchless\_mouse.bat

├── stop\_touchless\_mouse.bat

└── touchless\_mouse\_watchdog.ps1

```



\## 🚀 Setup



Open PowerShell in the `Mouse\_extracted` directory.



\### 1. Install dependencies



```powershell

python -m pip install -r requirements.txt

```



\### 2. Verify the MediaPipe model



Make sure this file exists:



```text

models/hand\_landmarker.task

```



\### 3. Start AERIX



```powershell

python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

```



\### 4. Open the interface



Open:



```text

http://127.0.0.1:8000/

```



FastAPI serves the AERIX frontend directly, so \*\*Node.js, npm, React, Vite, or a separate frontend server are not required for the main interface\*\*.



\## 🛡️ URL Safety \& Phishing Protection



AERIX includes an intelligent URL safety layer that combines:



\* Deterministic URL security rules

\* Local machine-learning classification

\* PhishTank reputation checks

\* Optional VirusTotal reputation checks

\* Parental filtering

\* Chrome/Edge link protection



The browser extension monitors links and communicates with the FastAPI `/api/safety/inspect` endpoint. Suspicious or dangerous results can prevent navigation.



\### API Configuration



Copy `.env.example` to `.env` and configure your API keys



