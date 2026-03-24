# Use a lightweight Node.js image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
