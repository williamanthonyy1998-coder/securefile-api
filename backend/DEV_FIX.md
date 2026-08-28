# Windows/tsx ESM resolution fix

The backend was using NodeNext + explicit .js imports while running TypeScript directly with tsx. On Windows/Node 26 this can resolve to a non-existent pricing.js instead of pricing.ts. The backend is now CommonJS for the development/build path and relative imports are extensionless. This allows tsx watch to load the TypeScript source directly.
