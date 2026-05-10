# Use Node.js LTS as the base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Copy the rest of the application source code
WORKDIR /app
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build the React frontend
WORKDIR /app/frontend
RUN npm run build

# Set the working directory to the backend to run the server
WORKDIR /app/backend

# Railway will automatically provide a PORT environment variable.
# Our server.js uses `process.env.PORT || 3000`, which correctly picks it up.
CMD ["npm", "start"]
