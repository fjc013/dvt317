import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as path from "path";

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const eventsTable = new dynamodb.Table(this, "EventsTable", {
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test only
      tableName: "EventsTable",
    });

    // Lambda Layer - using pre-published layer
    const dependenciesLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "DependenciesLayer",
      "arn:aws:lambda:us-east-2:363754370168:layer:fastapi-dependencies:2"
    );

    // Lambda Function
    const apiLambda = new lambda.Function(this, "ApiFunction", {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../backend"), {
        exclude: ["__pycache__", "*.pyc", ".pytest_cache", "deploy_package.sh"],
      }),
      layers: [dependenciesLayer],
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        EVENTS_TABLE_NAME: eventsTable.tableName,
      },
    });

    // Grant Lambda permissions to access DynamoDB
    eventsTable.grantReadWriteData(apiLambda);

    // API Gateway with CORS
    const api = new apigateway.LambdaRestApi(this, "EventsApi", {
      handler: apiLambda,
      proxy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "Events API Base URL",
      exportName: "EventsApiUrl",
    });

    new cdk.CfnOutput(this, "TableName", {
      value: eventsTable.tableName,
      description: "DynamoDB Table Name",
    });
  }
}
