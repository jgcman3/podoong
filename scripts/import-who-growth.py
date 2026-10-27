"""Import official daily WHO LMS tables. Python stdlib + curl; no runtime fetch."""
import hashlib, json, pathlib, subprocess, tempfile, zipfile
import xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/'
SOURCES = [
 ('weight','female','weight-for-age/expanded-tables/wfa-girls-zscore-expanded-tables.xlsx?sfvrsn=f01bc813_10'),
 ('weight','male','weight-for-age/expanded-tables/wfa-boys-zscore-expanded-tables.xlsx?sfvrsn=65cce121_10'),
 ('height','female','length-height-for-age/expandable-tables/lhfa-girls-zscore-expanded-tables.xlsx?sfvrsn=27f1e2cb_10'),
 ('height','male','length-height-for-age/expandable-tables/lhfa-boys-zscore-expanded-tables.xlsx?sfvrsn=7b4a3428_12'),
 ('head','female','head-circumference-for-age/expanded-tables/hcfa-girls-zscore-expanded-tables.xlsx?sfvrsn=3a34b8b0_8'),
 ('head','male','head-circumference-for-age/expanded-tables/hcfa-boys-zscore-expanded-tables.xlsx?sfvrsn=2ab1bec8_8'),
]
NS = {'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def rows(path):
 with zipfile.ZipFile(path) as z:
  strings = [''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si', NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
  root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
  for row in root.findall('.//s:row', NS):
   result = []
   for cell in row.findall('s:c', NS):
    value = cell.find('s:v',NS)
    text = value.text if value is not None else ''
    result.append(strings[int(text)] if cell.get('t')=='s' else text)
   yield result
if __name__ == '__main__':
 tables = {'female':{},'male':{}}; provenance=[]
 with tempfile.TemporaryDirectory() as tmp:
  for metric,sex,suffix in SOURCES:
   path = pathlib.Path(tmp)/f'{metric}-{sex}.xlsx'
   subprocess.run(['curl','--fail','--silent','--show-error','--location',BASE+suffix,'-o',str(path)],check=True)
   source=list(rows(path)); print(metric,sex,source[:2])
   header=source[0]
   indexes=[header.index(key) for key in ['Day','L','M','S']]
   data=[[float(row[i]) for i in indexes] for row in source[1:] if row and row[0]]
   assert data[0][0]==0 and len(data)>=1827
   assert all(int(row[0])==i and row[2]>0 and row[3]>0 for i,row in enumerate(data))
   tables[sex][metric]=[row[1:] for row in data[:1827]]
   provenance.append({'metric':metric,'sex':sex,'url':BASE+suffix,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':len(data)})
 out=ROOT/'src/features/insights/reference'
 (out/'who-lms.json').write_text(json.dumps(tables,separators=(',',':'))+'\n')
 (out/'sources.json').write_text(json.dumps({'source':'WHO Child Growth Standards','retrieved':'2026-10-27','columns':['L','M','S'],'index':'completed days since birth; 0 through 1826','files':provenance},indent=2)+'\n')
