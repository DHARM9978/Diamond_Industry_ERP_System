import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUser = process.env.DATABASE_USER;
const databasePassword = process.env.DATABASE_PASSWORD;
const databaseHost = process.env.DATABASE_HOST;
const databasePort = process.env.DATABASE_PORT || "3306";
const databaseName = process.env.DATABASE_NAME;

if (
    !databaseUser ||
    !databasePassword ||
    !databaseHost ||
    !databaseName
) {
    throw new Error(
        "Database environment variables are not properly configured."
    );
}

const databaseUrl =
    `mysql://${encodeURIComponent(databaseUser)}` +
    `:${encodeURIComponent(databasePassword)}` +
    `@${databaseHost}:${databasePort}` +
    `/${databaseName}`;

export default defineConfig({
    schema: "prisma/schema.prisma",

    migrations: {
        path: "prisma/migrations"
    },

    datasource: {
        url: databaseUrl
    }
});