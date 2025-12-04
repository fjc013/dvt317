"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const path = __importStar(require("path"));
class ApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB Table
        const eventsTable = new dynamodb.Table(this, "EventsTable", {
            partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test only
            tableName: "EventsTable",
        });
        // Lambda Layer - using pre-published layer
        const dependenciesLayer = lambda.LayerVersion.fromLayerVersionArn(this, "DependenciesLayer", "arn:aws:lambda:us-east-2:363754370168:layer:fastapi-dependencies:2");
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
exports.ApiStack = ApiStack;
