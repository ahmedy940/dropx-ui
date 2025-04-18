import dotenv from 'dotenv';
dotenv.config();

export default {
  development: {
    use_env_variable: "DROPX_DATABASE_URL",
    dialect: "postgres",
    dialectOptions: process.env.DATABASE_URL.includes("localhost")
      ? {} // No SSL locally
      : {
          ssl: {
            require: true,
            rejectUnauthorized: false, // Required for Heroku
          },
        },
  },
  test: {
    use_env_variable: "DROPX_DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
  production: {
    use_env_variable: "DROPX_DATABASE_URL",
    dialect: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};