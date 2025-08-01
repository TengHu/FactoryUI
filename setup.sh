#!/bin/bash

# FactoryUI Setup Script
# This script sets up the development environment for FactoryUI after cloning the repository

set -e  # Exit on any error

echo "🏭 FactoryUI Setup Script"
echo "========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "CLAUDE.md" ] || [ ! -d "factory-ui" ] || [ ! -d "backend" ]; then
    print_error "This script must be run from the FactoryUI root directory"
    print_error "Make sure you're in the correct directory with factory-ui/ and backend/ folders"
    exit 1
fi

print_status "Setting up FactoryUI development environment..."
echo ""

# Check for required tools
print_status "Checking for required tools..."

# Check for Node.js and npm
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm (usually comes with Node.js)"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher"
    exit 1
fi

# Check for pip
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    print_error "pip is not installed. Please install pip for Python package management"
    exit 1
fi

# Check for git
if ! command -v git &> /dev/null; then
    print_error "git is not installed. Please install git"
    exit 1
fi

print_success "All required tools are available"
echo ""

# Setup Backend
print_status "Setting up backend dependencies..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating Python virtual environment..."
    python3 -m venv venv
fi

print_status "Activating virtual environment and installing Python dependencies..."
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install backend dependencies
pip install -r requirements.txt

print_success "Backend dependencies installed successfully"
echo ""

# Clone feetech-servo-sdk if it doesn't exist
print_status "Setting up custom nodes..."
cd custom_nodes

if [ -d "feetech-servo-sdk" ]; then
    print_warning "feetech-servo-sdk already exists, skipping clone"
else
    print_status "Cloning feetech-servo-sdk from GitHub..."
    git clone https://github.com/TengHu/feetech-servo-sdk.git
    print_success "feetech-servo-sdk cloned successfully"
fi

# Install feetech-servo-sdk
if [ -d "feetech-servo-sdk" ]; then
    print_status "Installing feetech-servo-sdk..."
    cd feetech-servo-sdk
    pip install -e .
    cd ..
    print_success "feetech-servo-sdk installed successfully"
fi

# Clone LeRobot if it doesn't exist
print_status "Setting up LeRobot..."
if [ -d "lerobot" ]; then
    print_warning "LeRobot already exists, skipping clone"
else
    print_status "Cloning LeRobot from GitHub..."
    git clone https://github.com/huggingface/lerobot.git
    print_success "LeRobot cloned successfully"
fi

# Install LeRobot if it exists
if [ -d "lerobot" ]; then
    print_status "Installing LeRobot..."
    cd lerobot
    pip install -e .
    cd ..
    print_success "LeRobot installed successfully"
fi

cd .. # Back to backend directory
deactivate # Deactivate virtual environment
cd .. # Back to root directory

echo ""

# Setup Frontend
print_status "Setting up frontend dependencies..."
cd factory-ui

print_status "Installing Node.js dependencies..."
npm install

print_success "Frontend dependencies installed successfully"
cd .. # Back to root directory

echo ""

# Final setup verification
print_status "Verifying setup..."

# Check backend
if [ -f "backend/venv/bin/activate" ] && [ -f "backend/requirements.txt" ]; then
    print_success "Backend setup verified"
else
    print_error "Backend setup verification failed"
fi

# Check frontend
if [ -f "factory-ui/package.json" ] && [ -d "factory-ui/node_modules" ]; then
    print_success "Frontend setup verified"
else
    print_error "Frontend setup verification failed"
fi

# Check feetech-servo-sdk
if [ -d "backend/custom_nodes/feetech-servo-sdk" ]; then
    print_success "feetech-servo-sdk setup verified"
else
    print_warning "feetech-servo-sdk setup could not be verified"
fi

# Check LeRobot
if [ -d "backend/custom_nodes/lerobot" ]; then
    print_success "LeRobot setup verified"
else
    print_warning "LeRobot setup could not be verified"
fi

echo ""
print_success "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "==========="
echo ""
echo "1. Start the backend server:"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python -m uvicorn app.main:app --reload"
echo ""
echo "2. In a new terminal, start the frontend:"
echo "   cd factory-ui"
echo "   npm start"
echo ""
echo "3. Open your browser to http://localhost:3000"
echo ""
print_status "For more information, check the README.md files in backend/ and factory-ui/ directories"
print_status "Happy coding! 🚀"