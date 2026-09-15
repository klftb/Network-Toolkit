FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies (only production)
RUN npm install --production

# Copy source code
COPY index.js ./

# Expose port 80 for WeChat Cloud Run
EXPOSE 80

# Start server
CMD ["npm", "start"]
