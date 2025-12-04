# Events API Deployment Summary

## Base URL

```
https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/
```

## Architecture

- **Backend**: FastAPI (Python 3.11)
- **Database**: DynamoDB (EventsTable)
- **Compute**: AWS Lambda with custom layer for dependencies
- **API Gateway**: REST API with CORS enabled
- **Infrastructure**: AWS CDK (TypeScript)

## API Endpoints

### Health Check

- **GET** `/health`
- **Status**: 200
- **Response**: `{"status": "healthy"}`

### Get All Events

- **GET** `/events`
- **Status**: 200
- **Response**: `{"events": [...]}`

### Get Events by Status

- **GET** `/events?status=active`
- **Status**: 200
- **Response**: `{"events": [...]}`

### Get Single Event

- **GET** `/events/{event_id}`
- **Status**: 200 (found), 404 (not found)
- **Response**: Event object

### Create Event

- **POST** `/events`
- **Status**: 201 (created), 409 (already exists)
- **Request Body**:

```json
{
  "eventId": "api-test-event-456",
  "title": "API Gateway Test Event",
  "description": "Testing API Gateway integration",
  "date": "2024-12-15",
  "location": "API Test Location",
  "capacity": 200,
  "organizer": "API Test Organizer",
  "status": "active"
}
```

- **Response**: `{"eventId": "...", "message": "Event created successfully"}`

### Update Event

- **PUT** `/events/{event_id}`
- **Status**: 200 (updated), 404 (not found)
- **Request Body** (partial update):

```json
{
  "title": "Updated API Gateway Test Event",
  "capacity": 250
}
```

- **Response**: Updated event object

### Delete Event

- **DELETE** `/events/{event_id}`
- **Status**: 200 (deleted), 404 (not found)
- **Response**: `{"message": "Event deleted successfully"}`

## DynamoDB Schema

### Table: EventsTable

- **Partition Key**: `eventId` (String)
- **Billing Mode**: Pay-per-request

### Attributes

- `eventId` (String) - Primary key
- `title` (String)
- `description` (String)
- `date` (String)
- `location` (String)
- `capacity` (Number)
- `organizer` (String)
- `status` (String)
- `createdAt` (String) - ISO timestamp
- `updatedAt` (String) - ISO timestamp

## CORS Configuration

- **Allowed Origins**: All (\*)
- **Allowed Methods**: All (GET, POST, PUT, DELETE, OPTIONS)
- **Allowed Headers**: Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token

## Error Handling

- 400: Bad Request (validation errors)
- 404: Not Found
- 409: Conflict (duplicate eventId)
- 500: Internal Server Error

## Deployment Commands

### Build and Deploy

```bash
cd infrastructure
npm install
npm run build
npx cdk bootstrap  # First time only
npx cdk deploy --require-approval never
```

### Update Lambda Dependencies

If you need to update Python dependencies:

```bash
pip3 install -r backend/requirements.txt -t /tmp/lambda-layer/python --platform manylinux2014_x86_64 --only-binary=:all: --python-version 3.11
cd /tmp/lambda-layer && zip -r ../lambda-layer.zip python/
aws lambda publish-layer-version --layer-name fastapi-dependencies --description "FastAPI and dependencies" --zip-file fileb:///tmp/lambda-layer.zip --compatible-runtimes python3.11
```

Then update the layer ARN in `infrastructure/lib/api-stack.ts` and redeploy.

## Testing

### Example Test Sequence

```bash
# Create an event
curl -X POST https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/events \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-12-15", "eventId": "test-123", "organizer": "Test Org", "description": "Test event", "location": "Test Location", "title": "Test Event", "capacity": 100, "status": "active"}'

# Get all events
curl -X GET https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/events

# Get single event
curl -X GET https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/events/test-123

# Update event
curl -X PUT https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/events/test-123 \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Test Event", "capacity": 150}'

# Get events by status
curl -X GET "https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/events?status=active"

# Delete event
curl -X DELETE https://hfykcxq364.execute-api.us-east-2.amazonaws.com/prod/events/test-123
```

## Stack Resources

- **Lambda Function**: ApiStack-ApiFunctionCE271BD4-t87myAT7uYJ4
- **Lambda Layer**: arn:aws:lambda:us-east-2:363754370168:layer:fastapi-dependencies:2
- **DynamoDB Table**: EventsTable
- **API Gateway**: EventsApi
- **Region**: us-east-2

## Notes

- The API is publicly accessible
- DynamoDB table has `removalPolicy: DESTROY` for easy cleanup (dev/test only)
- Lambda function has 512 MB memory and 30-second timeout
- All timestamps are in UTC ISO format
