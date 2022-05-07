import { Credentials } from "@aws-sdk/types";

const access = process.env.NODE_ENV === "production" ? process.env.REACT_APP_AWS_KEY_ID : require('./secret').accessKey;
const secret = process.env.NODE_ENV === "production" ? process.env.REACT_APP_AWS_SECRET_KEY : require('./secret').secretKey;

export const creds: Credentials = {
    accessKeyId: access || "invalid",
    secretAccessKey: secret || "invalid"
}