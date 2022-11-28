import * as dotenv from 'dotenv';

export const creds = () => {
    if (process.env.NODE_ENV === "production") {
        return { accessKeyId:     process.env.REACT_APP_AWS_KEY_ID || 'invalid',
                 secretAccessKey: process.env.REACT_APP_AWS_SECRET_KEY || 'invalid' };
    }
    dotenv.config();
    return { accessKeyId:     process.env.AWS_KEY_ID || 'invalid',
             secretAccessKey: process.env.AWS_SECRET_KEY || 'invalid' };
};

export const google = () => {
    dotenv.config();
    return { client_id: process.env.REACT_APP_GOOGLE_LOGIN || 'invalid' }
}
