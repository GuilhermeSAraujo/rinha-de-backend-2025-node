echo "🚀 Building and publishing Docker image..."

docker build -t guilhermesouzaaraujo/rinha-2025-node:latest .

echo "✅ Docker image built successfully!"

echo "🚀 Pushing Docker image to Docker Hub..."

docker push guilhermesouzaaraujo/rinha-2025-node:latest

echo "✅ Docker image pushed successfully!"
