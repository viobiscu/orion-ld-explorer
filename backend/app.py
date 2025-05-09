from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Configuration
ORION_LD_URL = os.getenv("ORION_LD_URL", "http://localhost:1026")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

app = FastAPI(title="NGSI-LD API Proxy")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a client for HTTP requests
http_client = httpx.AsyncClient(timeout=30.0)

@app.get("/")
async def root():
    return {"message": "NGSI-LD API Proxy", "status": "running"}

@app.api_route("/api/ngsi-ld/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_request(request: Request, path: str):
    """
    Proxy all requests to the NGSI-LD broker
    """
    # Build the target URL
    target_url = f"{ORION_LD_URL}/ngsi-ld/v1/{path}"
    
    # Get the request content
    body = b""
    if request.method in ["POST", "PUT", "PATCH"]:
        body = await request.body()
    
    # Get headers from the request
    headers = dict(request.headers)
    # Remove headers that should not be forwarded
    headers.pop("host", None)
    
    # Get URL params
    params = dict(request.query_params)
    
    if DEBUG:
        print(f"Proxying request to: {target_url}")
        print(f"Method: {request.method}")
        print(f"Headers: {headers}")
        print(f"Params: {params}")
        if body:
            try:
                print(f"Body: {body.decode('utf-8')}")
            except:
                print(f"Body: [Binary data of length {len(body)}]")
    
    # Make the request to the target service
    try:
        response = await http_client.request(
            method=request.method,
            url=target_url,
            params=params,
            headers=headers,
            content=body,
        )
        
        if DEBUG:
            print(f"Response status: {response.status_code}")
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type or 'application/ld+json' in content_type:
                try:
                    print(f"Response body: {json.dumps(response.json(), indent=2)}")
                except:
                    print(f"Response body: [Failed to parse JSON]")
        
        # Return the response
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
        )
    except Exception as e:
        error_msg = str(e)
        if DEBUG:
            print(f"Error in proxy request: {error_msg}")
        return Response(
            content=json.dumps({"error": error_msg}),
            status_code=500,
            media_type="application/json",
        )

@app.get("/context/{path:path}")
async def serve_context(path: str):
    """
    Serve context files from the context directory
    """
    context_dir = os.path.join(os.path.dirname(__file__), "context")
    context_path = os.path.join(context_dir, path)
    
    if not os.path.exists(context_path):
        return Response(
            content=json.dumps({"error": "Context not found"}),
            status_code=404,
            media_type="application/json",
        )
    
    with open(context_path, "r") as f:
        context_content = f.read()
    
    return Response(
        content=context_content,
        media_type="application/ld+json",
    )

if __name__ == "__main__":
    import uvicorn
    print(f"Starting NGSI-LD Proxy server, forwarding to {ORION_LD_URL}")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
