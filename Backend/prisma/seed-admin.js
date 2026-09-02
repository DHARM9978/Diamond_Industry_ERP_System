require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("../src/generated/prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");


// ==========================================
// Prisma Database Connection
// ==========================================

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionLimit: 5
});

const prisma = new PrismaClient({
    adapter
});


const createInitialData = async () => {

    const email = "admin@diamonderp.com";
    const password = "Admin@123";

    // ==========================================
    // Create or find company
    // ==========================================

    let company = await prisma.company.findFirst({
        where: {
            companyName: "Diamond ERP"
        }
    });

    if (!company) {
        company = await prisma.company.create({
            data: {
                companyName: "Diamond ERP",
                address: "India",
                contactEmail: "admin@diamonderp.com",
                contactPhone: null
            }
        });

        console.log("Company created.");
    } else {
        console.log("Company already exists.");
    }


    // ==========================================
    // Check admin
    // ==========================================

    const existingAdmin = await prisma.admin.findUnique({
        where: {
            email
        }
    });

    if (existingAdmin) {
        console.log("Admin already exists.");
        return;
    }


    // ==========================================
    // Hash password
    // ==========================================

    const passwordHash = await bcrypt.hash(password, 12);


    // ==========================================
    // Create admin
    // ==========================================

    const admin = await prisma.admin.create({
        data: {
            adminName: "System Admin",
            email,
            phone: null,
            passwordHash,
            companyId: company.companyId
        }
    });


    console.log("==========================================");
    console.log("Initial setup completed");
    console.log("==========================================");
    console.log(`Company ID : ${company.companyId}`);
    console.log(`Admin ID   : ${admin.adminId}`);
    console.log(`Email      : ${email}`);
    console.log(`Password   : ${password}`);
    console.log("==========================================");
};

// ==========================================
// Run
// ==========================================

createInitialData()
    .catch((error) => {
        console.error("Failed to create admin:");
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });