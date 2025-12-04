from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import boto3
from boto3.dynamodb.conditions import Attr
import os
from datetime import datetime

app = FastAPI(title="Events API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DynamoDB setup
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('EVENTS_TABLE_NAME', 'EventsTable')
table = dynamodb.Table(table_name)

# Pydantic models
class EventCreate(BaseModel):
    eventId: str
    title: str
    description: str
    date: str
    location: str
    capacity: int
    organizer: str
    status: str = "active"

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    location: Optional[str] = None
    capacity: Optional[int] = None
    organizer: Optional[str] = None
    status: Optional[str] = None

@app.get("/")
def read_root():
    return {"message": "Events API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/events")
def get_events(status: Optional[str] = Query(None)):
    try:
        if status:
            response = table.scan(
                FilterExpression=Attr('status').eq(status)
            )
        else:
            response = table.scan()
        
        return {"events": response.get('Items', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving events: {str(e)}")

@app.get("/events/{event_id}")
def get_event(event_id: str):
    try:
        response = table.get_item(Key={'eventId': event_id})
        
        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return response['Item']
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving event: {str(e)}")

@app.post("/events", status_code=201)
def create_event(event: EventCreate):
    try:
        # Check if event already exists
        existing = table.get_item(Key={'eventId': event.eventId})
        if 'Item' in existing:
            raise HTTPException(status_code=409, detail="Event already exists")
        
        event_data = event.model_dump()
        event_data['createdAt'] = datetime.utcnow().isoformat()
        event_data['updatedAt'] = datetime.utcnow().isoformat()
        
        table.put_item(Item=event_data)
        
        return {"eventId": event.eventId, "message": "Event created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating event: {str(e)}")

@app.put("/events/{event_id}")
def update_event(event_id: str, event: EventUpdate):
    try:
        # Check if event exists
        existing = table.get_item(Key={'eventId': event_id})
        if 'Item' not in existing:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Build update expression
        update_data = {k: v for k, v in event.model_dump().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_expression = "SET " + ", ".join([f"#{k} = :{k}" for k in update_data.keys()])
        update_expression += ", #updatedAt = :updatedAt"
        
        expression_attribute_names = {f"#{k}": k for k in update_data.keys()}
        expression_attribute_names["#updatedAt"] = "updatedAt"
        
        expression_attribute_values = {f":{k}": v for k, v in update_data.items()}
        expression_attribute_values[":updatedAt"] = datetime.utcnow().isoformat()
        
        response = table.update_item(
            Key={'eventId': event_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW"
        )
        
        return response['Attributes']
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating event: {str(e)}")

@app.delete("/events/{event_id}")
def delete_event(event_id: str):
    try:
        # Check if event exists
        existing = table.get_item(Key={'eventId': event_id})
        if 'Item' not in existing:
            raise HTTPException(status_code=404, detail="Event not found")
        
        table.delete_item(Key={'eventId': event_id})
        
        return {"message": "Event deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting event: {str(e)}")
