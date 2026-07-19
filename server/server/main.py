import os
from fastapi import FastAPI, UploadFile, Form, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import zipfile, json, shutil, subprocess, socket, signal, psutil, traceback
import requests
import sys
from fastapi.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
SERVER_START_TIME = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

PLUGINS_DIR = os.path.join(BASE_DIR, "plugins")
DB_FILE = os.path.join(BASE_DIR, "demos.json")

# Track running backend processes
backend_processes = {}


def load_demos_db():
    if not os.path.exists(DB_FILE):
        return []

    with open(DB_FILE, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def save_demos_db(demos):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(demos, f, indent=2)

# -------------------------
# Get All Demos
# -------------------------



@app.on_event("startup")
def load_existing_demos():

    if not os.path.exists(DB_FILE):
        return

    demos = load_demos_db()

    for demo in demos:

        name = demo["name"]
        demo_path = os.path.join(PLUGINS_DIR, name)
        frontend_path = os.path.join(demo_path, "frontend")
        backend_path = os.path.join(demo_path, "backend")

        # Re-mount frontend
        if demo["url"].startswith("/apps/") and os.path.exists(frontend_path):

            frontend_serving_path = resolve_extracted_root(
                frontend_path,
                required_files=["index.html"]
            )
            try:
                mount_spa(name, frontend_serving_path)
            except Exception as e:
                print(f"Warning: Could not mount frontend for {name}: {e}")

            images_path = os.path.join(frontend_serving_path, "images")
            if os.path.exists(images_path):
                mount_or_replace_public_images(images_path, name)
            
        # Restart backend if hosted
        if os.path.exists(backend_path):
            backend_entry = start_backend(backend_path, name)
            if backend_entry:
                demo["backend"] = backend_entry

    # Save updated ports
    save_demos_db(demos)

def resolve_extracted_root(base_path: str, required_dirs=None, required_files=None, max_depth: int = 4):
    required_dirs = required_dirs or []
    required_files = required_files or []

    def has_expected(path: str):
        dirs_ok = all(os.path.isdir(os.path.join(path, d)) for d in required_dirs)
        files_ok = all(os.path.isfile(os.path.join(path, f)) for f in required_files)
        return dirs_ok and files_ok

    if not os.path.isdir(base_path):
        return base_path

    # Prefer the shallowest valid directory (closest to extraction root).
    if has_expected(base_path):
        return base_path

    base_depth = base_path.rstrip("/\\").count(os.sep)
    best_match = None
    best_depth = None

    for root, dirs, _ in os.walk(base_path):
        current_depth = root.rstrip("/\\").count(os.sep) - base_depth
        if current_depth > max_depth:
            dirs[:] = []
            continue

        if has_expected(root):
            if best_match is None or current_depth < best_depth:
                best_match = root
                best_depth = current_depth

    return best_match or base_path


def remove_route_by_path(path: str):
    app.router.routes = [
        route
        for route in app.router.routes
        if getattr(route, "path", None) != path
    ]


def mount_or_replace_public_images(images_path: str, name: str):
    remove_route_by_path("/public/images")
    app.mount(
        "/public/images",
        StaticFiles(directory=images_path),
        name=f"{name}-images"
    )


def mount_spa(name: str, frontend_path: str):

    assets_path = f"/apps/{name}/assets"
    spa_path = f"/apps/{name}/{{path:path}}"
    assets_dir = os.path.join(frontend_path, "assets")

    # Replace existing mounts/routes for re-uploads of the same demo name.
    remove_route_by_path(assets_path)
    remove_route_by_path(spa_path)

    # Serve assets if the folder exists
    if os.path.exists(assets_dir):
        app.mount(
            assets_path,
            StaticFiles(directory=assets_dir),
            name=f"{name}-assets"
        )

    # SPA fallback — serve index.html for all paths
    index_file = os.path.join(frontend_path, "index.html")
    if not os.path.exists(index_file):
        raise FileNotFoundError(
            f"Frontend index.html not found at '{index_file}'. "
            "Zip may be malformed or extracted into an unexpected structure."
        )

    async def spa_fallback(path: str):
        return FileResponse(index_file)

    app.add_api_route(spa_path, spa_fallback, methods=["GET"])


@app.get("/api/demos")
def get_demos():
    return load_demos_db()

def get_free_port():
    s = socket.socket()
    s.bind(("", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def start_backend(backend_path, demo_name):
    python_backend_path = resolve_extracted_root(
        backend_path,
        required_files=["main.py"]
    )
    node_backend_path = resolve_extracted_root(
        backend_path,
        required_files=["server.mjs"]
    )

    port = get_free_port()

    if os.path.exists(os.path.join(python_backend_path, "main.py")):
        requirements_path = os.path.join(python_backend_path, "requirements.txt")
        if os.path.exists(requirements_path):
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                cwd=python_backend_path
            )

        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--port",
                str(port)
            ],
            cwd=python_backend_path
        )

        backend_processes[demo_name] = process
        return f"http://localhost:{port}"

    if os.path.exists(os.path.join(node_backend_path, "server.mjs")):
        env = os.environ.copy()
        env["PORT"] = str(port)

        process = subprocess.Popen(
            ["node", "server.mjs"],
            cwd=node_backend_path,
            env=env
        )

        backend_processes[demo_name] = process
        return f"http://localhost:{port}"

    print(f"Skipping backend startup for {demo_name}: no supported entrypoint found under {backend_path}")
    return None


@app.post("/api/admin/upload-demo")
async def upload_demo(
    name: str = Form(...),
    description: str = Form(None),
    owner: str = Form(None),
    category: str = Form(None),

    frontend_zip: UploadFile = File(None),
    frontend_url: str = Form(None),

    backend_zip: UploadFile = File(None),
    backend_url: str = Form(None)
):
    step = "init"
    try:
        step = "validate_input"
        name = name.strip()
        print(f"[upload-demo] name={name!r}, frontend_zip={getattr(frontend_zip, 'filename', None)}, "
              f"frontend_url={frontend_url!r}, backend_zip={getattr(backend_zip, 'filename', None)}, "
              f"backend_url={backend_url!r}")

        if not frontend_zip and not frontend_url:
            return JSONResponse(status_code=400, content={
                "success": False, "error": "Provide frontend zip or frontend url", "step": step
            })

        if not backend_zip and not backend_url:
            return JSONResponse(status_code=400, content={
                "success": False, "error": "Provide backend zip or backend url", "step": step
            })

        step = "prepare_paths"
        demo_path = os.path.join(PLUGINS_DIR, name)
        frontend_path = os.path.join(demo_path, "frontend")
        backend_path = os.path.join(demo_path, "backend")
        print(f"[upload-demo] demo_path={demo_path}")

        # Clean old demo
        if os.path.exists(demo_path):
            shutil.rmtree(demo_path)

        os.makedirs(demo_path, exist_ok=True)

        errors = []

        # -------------------------
        # FRONTEND
        # -------------------------
        step = "frontend_upload"

        if frontend_zip:
            try:
                os.makedirs(frontend_path, exist_ok=True)
                zip_path = os.path.join(demo_path, "frontend.zip")
                print(f"[upload-demo] writing frontend zip to {zip_path}")

                contents = await frontend_zip.read()
                print(f"[upload-demo] frontend zip size: {len(contents)} bytes")
                with open(zip_path, "wb") as f:
                    f.write(contents)

                with zipfile.ZipFile(zip_path, 'r') as zf:
                    print(f"[upload-demo] frontend zip entries: {zf.namelist()[:20]}")
                    zf.extractall(frontend_path)

                frontend_serving_path = resolve_extracted_root(
                    frontend_path,
                    required_files=["index.html"]
                )
                print(f"[upload-demo] frontend_serving_path={frontend_serving_path}")

                frontend_entry = f"/apps/{name}"
                mount_spa(name, frontend_serving_path)

                images_path = os.path.join(frontend_serving_path, "images")
                if os.path.exists(images_path):
                    mount_or_replace_public_images(images_path, name)

            except zipfile.BadZipFile as e:
                traceback.print_exc()
                errors.append(f"Frontend: uploaded file is not a valid ZIP — {e}")
                frontend_entry = f"/apps/{name}"
            except Exception as e:
                traceback.print_exc()
                errors.append(f"Frontend: {str(e)}")
                frontend_entry = f"/apps/{name}"
        else:
            frontend_entry = frontend_url

        # -------------------------
        # BACKEND
        # -------------------------
        step = "backend_upload"

        if backend_zip:
            try:
                os.makedirs(backend_path, exist_ok=True)
                zip_path = os.path.join(demo_path, "backend.zip")
                print(f"[upload-demo] writing backend zip to {zip_path}")

                contents = await backend_zip.read()
                print(f"[upload-demo] backend zip size: {len(contents)} bytes")
                with open(zip_path, "wb") as f:
                    f.write(contents)

                with zipfile.ZipFile(zip_path, 'r') as zf:
                    print(f"[upload-demo] backend zip entries: {zf.namelist()[:20]}")
                    zf.extractall(backend_path)

                backend_entry = start_backend(backend_path, name)
                if not backend_entry:
                    errors.append("Backend: no supported entrypoint (main.py or server.mjs) found")

            except zipfile.BadZipFile as e:
                traceback.print_exc()
                errors.append(f"Backend: uploaded file is not a valid ZIP — {e}")
                backend_entry = None
            except Exception as e:
                traceback.print_exc()
                errors.append(f"Backend: {str(e)}")
                backend_entry = None
        else:
            backend_entry = backend_url

        if errors and not frontend_entry and not backend_entry:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": f"Upload failed: {'; '.join(errors)}",
                         "step": step, "warnings": errors}
            )

        # -------------------------
        # SAVE METADATA
        # -------------------------
        step = "save_metadata"

        demos = get_demos()
        demos.append({
            "name": name,
            "description": description,
            "owner": owner,
            "url": frontend_entry,
            "backend": backend_entry,
            "category": category
        })
        save_demos_db(demos)
        print(f"[upload-demo] saved demo {name!r}, total demos: {len(demos)}")

        result = {"success": True, "message": "Uploaded successfully"}
        if errors:
            result["warnings"] = errors
        return result

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[upload-demo] EXCEPTION at step={step}: {e}\n{tb}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "step": step,
                "trace": tb
            }
        )


@app.put("/api/admin/edit-demo/{demo_name}")
async def edit_demo(
    demo_name: str,
    name: str = Form(None),
    description: str = Form(None),
    owner: str = Form(None),
    category: str = Form(None)
):
    demos = get_demos()
    demo = next((d for d in demos if d["name"] == demo_name), None)
    if not demo:
        return JSONResponse(status_code=404, content={"success": False, "error": f"Demo '{demo_name}' not found"})

    if name is not None:
        demo["name"] = name
    if description is not None:
        demo["description"] = description
    if owner is not None:
        demo["owner"] = owner
    if category is not None:
        demo["category"] = category

    save_demos_db(demos)

    return {"success": True, "message": "Updated successfully"}


@app.delete("/api/admin/delete-demo/{demo_name}")
def delete_demo(demo_name: str):
    try:
        demos = get_demos()
        updated = [d for d in demos if d["name"] != demo_name]
        if len(updated) == len(demos):
            return JSONResponse(status_code=404, content={"success": False, "error": f"Demo '{demo_name}' not found"})

        # Kill backend process if running
        proc = backend_processes.pop(demo_name, None)
        if proc and proc.poll() is None:
            try:
                parent = psutil.Process(proc.pid)
                for child in parent.children(recursive=True):
                    child.kill()
                parent.kill()
                parent.wait(timeout=5)
            except Exception as e:
                print(f"[delete] Warning: could not kill backend process for {demo_name}: {e}")

        # Remove plugin files if present
        demo_path = os.path.join(PLUGINS_DIR, demo_name)
        if os.path.exists(demo_path):
            shutil.rmtree(demo_path, ignore_errors=True)

        save_demos_db(updated)

        return {"success": True, "message": "Deleted successfully"}
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[delete] EXCEPTION: {e}\n{tb}")
        return JSONResponse(status_code=500, content={
            "success": False, "error": str(e), "trace": tb
        })


@app.api_route("/api/{demo}/{full_path:path}", methods=["GET","POST","PUT","DELETE","PATCH","OPTIONS"])
async def proxy_to_demo_backend(
    demo: str,
    full_path: str,
    request: Request
):
    demos = get_demos()
    print("got req",full_path,demo)
    demo_obj = next((d for d in demos if d["name"] == demo), None)

    if not demo_obj:
        return Response(f"Demo '{demo}' not found", status_code=404)

    if not demo_obj.get("backend"):
        return Response(f"Demo '{demo}' backend is not configured", status_code=502)

    target_url = f'{demo_obj["backend"].rstrip("/")}/{full_path}'
    print("backend",target_url)
    resp = requests.request(
        method=request.method,
        url=target_url,
        headers={k: v for k, v in request.headers.items() if k.lower() != "host"},
        params=request.query_params,
        data=await request.body()
    )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers)
    )
print("Backend ready")


@app.api_route("/", methods=["GET"])
def root():
    return {"message": "Server is running", "deployment_date": SERVER_START_TIME}