const app = require("./src/app");

const PORT = process.env.PORT || 5000;

app.listen(PORT,"0.0.0.0", () => {
    console.log(`Diamond ERP Backend running on 0.0.0.0:${PORT}`);
});