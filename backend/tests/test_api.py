import base64, io, json, os, tempfile, time, unittest
from unittest.mock import patch
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient
os.environ.update(APP_TOKEN='a'*40, DEVICE_TOKEN='d'*40, OPENAI_API_KEY='test-key-not-real', OPENAI_MODEL='vision-test-model')
from backend import app as api

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); api.DB=Path(self.tmp.name)/'db.sqlite3'
        api.requests_at.clear(); self.client=TestClient(api.app); self.client.__enter__()
        self.headers={'Authorization':'Bearer '+'a'*40}
    def tearDown(self):
        for _ in range(100):
            if not api.lock.locked(): break
            time.sleep(.01)
        self.client.__exit__(None,None,None); self.tmp.cleanup()
    def test_upload_answer_and_auth(self):
        im=Image.new('RGB',(200,200),'white'); b=io.BytesIO(); im.save(b,'JPEG')
        calls=[]
        def mock(req,timeout):
            calls.append(json.loads(req.data)); self.assertEqual(req.full_url,'https://api.openai.com/v1/responses')
            self.assertEqual(req.get_header('Authorization'),'Bearer test-key-not-real')
            return io.BytesIO(json.dumps({'status':'completed','output':[{'type':'reasoning'}, {'type':'message','content':[{'type':'output_text','text':'2 + 2 = 4'}]}]}).encode())
        with patch.object(api.urllib.request,'urlopen',mock):
            profile=base64.b64encode(json.dumps({'course':'Statistik','rules':'Maximal 100 Wörter'},ensure_ascii=False).encode()).decode()
            r=self.client.post('/api/frames',content=b.getvalue(),headers={**self.headers,'Content-Type':'image/jpeg','X-Study-Profile':profile})
            self.assertEqual(r.status_code,202); jid=r.json()['id']
            for _ in range(100):
                job=self.client.get('/api/jobs/'+jid,headers=self.headers).json()
                if job['status']!='processing':break
                time.sleep(.01)
            self.assertEqual(job['answer'],'2 + 2 = 4'); self.assertEqual(job['status'],'done')
        self.assertIn('Antworte immer auf Deutsch',calls[0]['instructions']);self.assertIn('Aufgabe 1)',calls[0]['instructions']);
        self.assertIn('Statistik',calls[0]['input'][0]['content'][0]['text']);self.assertIn('100 Wörter',calls[0]['input'][0]['content'][0]['text']);
        self.assertFalse(calls[0]['store']); self.assertEqual(calls[0]['model'],'vision-test-model')
        self.assertTrue(calls[0]['input'][0]['content'][1]['image_url'].startswith('data:image/jpeg;base64,'))
        self.assertEqual(self.client.get('/api/jobs/'+jid).status_code,401)
        self.assertEqual(self.client.get('/api/jobs/'+jid,headers={'Authorization':'Bearer '+'d'*40}).status_code,401)
        self.assertEqual(self.client.get('/api/jobs/nope',headers=self.headers).status_code,404)
    def test_origins_and_invalid_photo(self):
        for origin in ('http://192.168.4.1','http://10.0.0.15','http://172.20.10.2'):
            r=self.client.options('/api/frames',headers={'Origin':origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'})
            self.assertEqual(r.status_code,200); self.assertEqual(r.headers['access-control-allow-origin'],origin)
        r=self.client.options('/api/frames',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'POST'})
        self.assertEqual(r.status_code,400)
        self.assertEqual(self.client.post('/api/frames',content=b'bad',headers={**self.headers,'Content-Type':'image/jpeg'}).status_code,400)
        self.assertFalse(api.lock.locked())
    def test_profile_validation_and_cache(self):
        from starlette.requests import Request
        def request(profile):
            value=base64.b64encode(json.dumps(profile,ensure_ascii=False).encode())
            return Request({'type':'http','headers':[(b'x-study-profile',value)]})
        p=api.study_profile(request({'course':'Statistik','rules':'Maximal 100 Wörter'}))
        self.assertEqual(p['course'],'Statistik');self.assertEqual(p['rules'],'Maximal 100 Wörter')
        self.assertNotEqual(api.analysis_digest(b'image',p),api.analysis_digest(b'image',api.DEFAULT_PROFILE))
        with self.assertRaises(api.HTTPException):api.study_profile(request({'course':'x'*121}))
        r=self.client.post('/api/frames',content=b'bad',headers={**self.headers,'Content-Type':'image/jpeg','X-Study-Profile':'not-base64'})
        self.assertEqual(r.status_code,400);self.assertFalse(api.lock.locked())
        r=self.client.options('/api/frames',headers={'Origin':'http://192.168.4.1','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,x-study-profile'})
        self.assertEqual(r.status_code,200)

    def test_incomplete_is_not_delivered(self):
        def mock(req,timeout):return io.BytesIO(b'{"status":"incomplete","output":[{"type":"message","content":[{"type":"output_text","text":"partial"}]}]}')
        with api.connection() as c:c.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?)',('job',time.time(),'processing','','','digest'))
        api.lock.acquire()
        with patch.object(api.urllib.request,'urlopen',mock):api.analyze('job',b'jpeg')
        r=self.client.get('/api/jobs/job',headers=self.headers).json()
        self.assertEqual(r['status'],'error');self.assertEqual(r['answer'],'');self.assertFalse(api.lock.locked())
if __name__=='__main__':unittest.main()
