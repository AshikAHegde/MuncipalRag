import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
console.log(import.meta.url)
console.log(__filename)
console.log(__dirname)
console.log(backendRoot)

