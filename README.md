# Factory UI

A powerful GUI for open-source robotics. Offers modular, reusable building blocks—like Lego—for constructing custom robot agent workflows.


## 📋 Prerequisites

Before you begin, assemble and set up your robot by following the instructions at [https://bambot.org/](https://bambot.org/). Find the serial port that's connected to your robot.

## Examples 

Explore the sample workflows located in `backend/user/workflows`, such as:
- Teleoperating a robot
  
<img width="659" height="741" alt="image" src="https://github.com/user-attachments/assets/77f0d0ef-bf25-4147-8422-d51b5597fb67" />

- Teleoperating using a keyboard

<img width="714" height="746" alt="image" src="https://github.com/user-attachments/assets/a3e3a737-2cc1-4b09-bb20-7191470b32c0" />

- Dual teleoperation with two or more teleoperators


## 🚀 Quick Start

### 1. Setup
```bash
git clone <repository-url>
cd FactoryUI
./setup.sh
```

### 2. Start Backend
```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload
```

### 3. Start Frontend (New Terminal)
```bash
cd factory-ui
npm start
```

### 4. Open Application
Visit [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

### How to create custom nodes to extend your workflow
- [Custom Nodes Guide](backend/custom_nodes/README.md) - Create your own workflow nodes


## 📄 License

MIT
