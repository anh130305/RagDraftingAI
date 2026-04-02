FROM node:20-slim

WORKDIR /app

COPY package.json ./

# Remove package-lock to avoid host-container os mismatch bindings
RUN rm -f package-lock.json && npm install

COPY . .

CMD ["npm", "run", "dev"]
