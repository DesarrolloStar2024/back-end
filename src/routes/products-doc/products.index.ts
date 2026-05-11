// Products: re-exports the existing productsRoute (complex handlers)
// The route definitions in products.routes.ts are registered on the main OpenAPIHono
// for OpenAPI spec generation, while the actual handlers live in ../products.ts
export { productsRoute } from "../products.js";
