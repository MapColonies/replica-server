import { DbCommonConfig, DbConfig } from "../interfaces";

export function convertDBConfigToTypeorm(dbConfig: DbCommonConfig): DbConfig {
    if (dbConfig.ssl.enabled) {
        if (dbConfig.ssl.ca && dbConfig.ssl.cert && dbConfig.ssl.key) {
            const newConfig: DbConfig = {
                enableSslAuth: dbConfig.ssl.enabled,
                sslPaths: {
                    ca: dbConfig.ssl.ca,
                    cert: dbConfig.ssl.cert,
                    key: dbConfig.ssl.key
                }, type: "postgres", schema: dbConfig.schema
            }
            return newConfig;
        } else {
            throw new Error('Configuration error: db configuration Invalid or missing configuration.')
        }
    }
    return {
        enableSslAuth: false,
        sslPaths: {
            ca: "",
            cert: "",
            key: ""
        }, // or a default value if necessary
        type: "postgres",
        schema: dbConfig.schema
    };

}