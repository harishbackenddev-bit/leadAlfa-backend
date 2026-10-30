require("dotenv").config();
require('./models'); // Ensure models are loaded
require('./cron/socialProfileSync.cron');
require('./cron/autoApproveSubmissions'); 
const express = require("express");
const http = require('http');
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { execSync } = require("child_process");
const { testDbConnection } = require("./config/database");
const { sequelize } = require("./config/database");
const { runSeeds } = require("./utils/seedData");
const { startSocketServer } = require("./socket/socketServer");
const { redis } = require('./utils/redisUtil');
const { globalLimiter } = require('./middlewares/rateLimiter');

const app = express();
const server = http.createServer(app);

const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const assetRoutes = require("./routes/assetRoutes");
const creatorProfileRoutes = require("./routes/creatorProfileRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const skillRoutes = require("./routes/skillRoutes");
const brandProfileRoutes = require("./routes/brandProfileRoutes");
const campaignRoutes = require("./routes/campaignRoutes");
const campaignApplicationRoutes = require("./routes/campaignApplicationRoutes");
const creatorJobRoutes = require("./routes/creatorJobRoutes");
const chatRoutes = require("./routes/chatRoutes");
const socialAccountRoutes = require("./routes/socialAccountRoutes");
const adminRoutes = require("./routes/adminRoutes");
const campaignInvitationRoutes = require("./routes/campaignInvitationRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const workSubmissionRoutes = require("./routes/workSubmissionRoutes");
const brandSubmissionRoutes = require("./routes/brandSubmissionRoutes");
const campaignActivityRoutes = require("./routes/campaignActivityRoutes");
const contactRoutes = require("./routes/contactRoutes");
const bookCallRequestRoutes = require("./routes/bookCallRequestRoutes");
const userFeedbackRoutes = require("./routes/userFeedbackRoutes");
const homeRoutes = require("./routes/homeRoutes");
const shipmentRoutes = require("./routes/shipmentRoutes");
const tradesafewebhookRoutes = require("./routes/webhookRoutes");
const tradesafePaymentRoutes = require("./routes/tradesafePaymentRoutes");
const tradesafeRegistrationRoutes = require("./routes/tradesafeRegistrationRoutes");


app.set('trust proxy', 1);

if (process.env.APP_ENV !== "production") {
  app.use(cors());
} else {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );
}

app.use(express.json());
app.use(cookieParser());


app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
  });
});


async function runMigrations() {
  const env = process.env.NODE_ENV || "development";
  try {
    console.log("Running pending database migrations...");
    execSync(`npx sequelize-cli db:migrate --env ${env}`, { stdio: "inherit" });
    console.log("Database migrations completed successfully.");
  } catch (err) {
    console.error("Database migration failed:", err.message);
    console.log("Rolling back all migrations");

    try {
      execSync(`npx sequelize-cli db:migrate:undo --env ${env}`, {
        stdio: "inherit",
      });
      console.log("Rollback completed. Database reverted to previous state.");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr.message);
    }
  }
}

(async () => {
  try {

    await runMigrations();


    await testDbConnection();
    console.log("Database connection established successfully.");

    await runSeeds();


    const { io, pubClient, subClient } = await startSocketServer(server);
    app.set("io", io);
    global.__IO__ = io;
    console.log("Socket.IO server started and attached to HTTP server.");


    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });


    let isShuttingDown = false;

    const shutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`${signal} received. Starting graceful shutdown...`);


      server.close(async (serverErr) => {
        if (serverErr) console.error('Error closing HTTP server:', serverErr.message);

        try {
  
          await io.close();
          console.log('Socket.IO closed.');


          if (pubClient && pubClient.isOpen) await pubClient.quit();
          if (subClient && subClient.isOpen) await subClient.quit();


          if (redis && redis.isOpen) await redis.quit();
          console.log('Redis clients closed.');


          await sequelize.close();
          console.log('Database connection closed.');

          console.log('Graceful shutdown complete.');
          process.exit(0);
        } catch (err) {
          console.error('Error during graceful shutdown:', err.message);
          process.exit(1);
        }
      });

      // Force exit after 30 seconds if shutdown hangs (e.g. stuck requests)
      setTimeout(() => {
        console.error('Shutdown timeout exceeded. Forcing exit.');
        process.exit(1);
      }, 30000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.log(err);
    console.error("Server startup failed:", err.message);
  }
})();


app.use('/api', globalLimiter);



app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/creator", creatorProfileRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/brand", brandProfileRoutes);
app.use("/api/campaigns",campaignRoutes);
app.use("/api/campaign-applications", campaignApplicationRoutes);
app.use("/api/creator", creatorJobRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api", socialAccountRoutes);
app.use("/api/admin", adminRoutes);
app.use("/", campaignInvitationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/creator", workSubmissionRoutes);
app.use("/api", brandSubmissionRoutes);
app.use("/api", campaignActivityRoutes);
app.use("/api/contact-requests", contactRoutes);
app.use("/api/book-call-requests", bookCallRequestRoutes);
app.use("/api/user-feedback", userFeedbackRoutes);
app.use("/api/home", homeRoutes);
app.use("/api", shipmentRoutes);



app.use("/api/webhook", tradesafewebhookRoutes);
app.use("/api/tradesafe", tradesafeRegistrationRoutes);

app.use("/api/tradesafe-payment", tradesafePaymentRoutes);
