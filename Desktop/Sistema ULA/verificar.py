import urllib.request
import json
req = urllib.request.urlopen("http://localhost:8000/api/estado-academico?plan=cuatrimestral&fecha=2026-07-20")
print(json.loads(req.read()))
