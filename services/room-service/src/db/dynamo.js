import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.DYNAMODB_REGION,
});

const ddbDocClient = DynamoDBDocumentClient.from(client);

export default ddbDocClient;
