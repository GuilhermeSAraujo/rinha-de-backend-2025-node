// MongoDB initialization script for Rinha de Backend 2025
// This script runs when the MongoDB container starts for the first time

// Switch to the rinha database
db = db.getSiblingDB("rinha");

// Create collections for payments
db.createCollection("payments");

// Create indexes for better performance
db.payments.createIndex({ requested_at: 1 });
db.payments.createIndex({ service: 1 });
db.payments.createIndex({ correlation_id: 1 }, { unique: true });

// Create compound index for efficient summary queries
db.payments.createIndex({ service: 1, requested_at: 1 });

print("MongoDB initialization completed successfully!");
print("Database: rinha");
print("Collections created: payments");
print("Indexes created for optimal performance");
