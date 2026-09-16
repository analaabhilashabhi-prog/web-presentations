// Rebuilds the Certifications section from what is on disk. Run it after the badge
// folder, the cohort folders or the count spreadsheet change:
//
//   node tools/publish-certifications.cjs            # publish
//   node tools/publish-certifications.cjs --dry-run  # print the block, touch nothing
//
// Three sources, and the split matters. The counts come from the spreadsheet the
// user maintains. The artwork comes from the folders under backend/uploads. The
// prose — vendor names, domains, what each credential tests — is authored, so it
// lives in this file: it is the only record of it, and a script that reads it from
// the database it writes to cannot rebuild anything.
//
// No dependencies. The workbook reader and the image-dimension reader are both
// here, because adding a package to publish one section is a worse trade than
// forty lines of ZIP and header parsing.
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const UPLOADS = path.join(ROOT, 'backend', 'uploads');
const CERT_DIR = path.join(UPLOADS, 'certifications');
const BADGE_DIR = path.join(CERT_DIR, 'badges');
const COHORT_DIR = path.join(CERT_DIR, 'Certification Images  Sorted');
const WORKBOOK = path.join(CERT_DIR, 'Certification Logos', 'Logos.xlsx');
const BACKDROP = 'certifications/register-crowd.jpg';

/* Resolved by key at run time, with the id below only as a hint. A hardcoded id
   stops being true the moment the section is deleted and remade — which is exactly
   what happened to this one — and the failure is a 404 halfway through a publish
   rather than anything readable. The section is created if it is not there. */
const SECTION_KEY = 'certifications';
const SECTION_TITLE = 'Certifications';
const ORG = 'technical-hub';
let SECTION = 'sec_69c6554f56bd453e';
const LAYOUT = { x: 0, y: 0, w: 12, h: 15 };
const HOST = { host: '127.0.0.1', port: 4173 };
const LOGIN = { email: 'admin@org.local', password: 'Admin@123' };

const DRY = process.argv.includes('--dry-run');

const COPY = {
  eyebrow: 'Certifications and credentials',
  title: 'Certified, cohort by cohort',
  lead: 'Every card is a batch that sat the exam and passed — the vendor, the count and the room, exactly as it was published.',
  quote: 'A certificate is not the finish line. It is the receipt for every evening someone kept going after the subject stopped being easy.',
  quoteBy: 'Technical Hub · certifying since 2016',
};

/* The credential catalogue: name, awarding body, field, the count as last
   verified, and what the exam tests.
 *
 * The count is carried here rather than read blindly from the workbook because the
 * workbook is a living document and its names drift — the revision on disk while
 * this was written calls the same exam "Arduino Certification" where the deck says
 * "Arduino Fundamentals", and six Microsoft Technology Associate rows have gone
 * from it entirely. So the workbook may only *raise its hand*: it overrides a count
 * when the names match exactly or an alias says they are the same exam, and
 * otherwise the verified number stands and the mismatch is reported.
 *
 * Fuzzy matching was tried and removed. On this workbook it paired "Microsoft Azure
 * Fundamentals" with "Azure Administrator Associate" (1,728 against 660) and the
 * Pega System Architect with the Senior one. A deck quietly showing the wrong
 * number is far worse than a deck showing last week's.
 *
 * Four skills each, from the published exam objectives; the schema caps at eight. */
const CREDENTIALS = [
  ["Adobe Certified Professional Using Adobe Photoshop", "Adobe", "Digital imaging", 66, [
    "Non-destructive layers and masking",
    "Selections, compositing and retouching",
    "Colour correction with adjustment layers",
    "Export for print, web and mobile"
  ]],
  ["Arduino Fundamentals", "Arduino", "Embedded electronics", 210, [
    "Reading schematics and breadboard wiring",
    "Sketch structure and control flow in C++",
    "Analog and digital sensor input",
    "PWM, motor and actuator control"
  ]],
  ["AutoCAD Certified User", "Autodesk", "Technical drafting", 42, [
    "Precision 2D drawing and coordinate entry",
    "Layers, linetypes and object properties",
    "Dimensioning and annotation standards",
    "Blocks, layouts and plotting"
  ]],
  ["Automation Anywhere Certified Advanced RPA Professional", "Automation Anywhere", "Robotic process automation", 210, [
    "Bot architecture and reusable components",
    "Exception handling and error recovery",
    "Document extraction with IQ Bot",
    "Credential Vault and bot deployment"
  ]],
  ["Automation Anywhere University Certified Essentials RPA Professional", "Automation Anywhere", "RPA essentials", 1152, [
    "Recorder-based task automation",
    "Variables, loops and conditional logic",
    "Excel and file system actions",
    "Scheduling and running bots in Control Room"
  ]],
  ["AWS Certified Developer Associate", "Amazon Web Services", "Cloud development", 124, [
    "Application development with SDK and CLI",
    "Lambda, API Gateway and DynamoDB",
    "IAM roles, KMS and secrets handling",
    "CI/CD with CodePipeline and CloudFormation"
  ]],
  ["AWS Certified Cloud Practitioner", "Amazon Web Services", "Cloud foundations", 4914, [
    "Core services and global infrastructure",
    "The shared responsibility security model",
    "Pricing, billing and cost management",
    "Well-Architected design principles"
  ]],
  ["AWS Certified Solutions Architect - Associate", "Amazon Web Services", "Cloud architecture", 204, [
    "Highly available multi-tier architectures",
    "VPC design, subnets and routing",
    "Choosing between S3, EBS and EFS",
    "Cost and performance optimisation"
  ]],
  ["Azure Administrator Associate", "Microsoft Azure", "Cloud administration", 660, [
    "Identity governance with Microsoft Entra ID",
    "Virtual networks, NSGs and peering",
    "VM, storage and backup administration",
    "Monitoring with Azure Monitor and Log Analytics"
  ]],
  ["Cisco Certified CCNA", "Cisco", "Enterprise networking", 522, [
    "IPv4 and IPv6 addressing and subnetting",
    "Switching, VLANs and spanning tree",
    "OSPF and static routing",
    "Access control lists and network security"
  ]],
  ["CISCO CyberOps Associate", "Cisco", "Security operations", 18, [
    "SOC monitoring and alert triage",
    "Network intrusion analysis",
    "Host-based forensics fundamentals",
    "Incident response and the kill chain"
  ]],
  ["Google Cloud Certified Associate Cloud Engineer", "Google Cloud", "Cloud engineering", 420, [
    "Project, IAM and billing configuration",
    "Compute Engine and GKE deployment",
    "Cloud Storage and managed databases",
    "Monitoring and logging with Operations Suite"
  ]],
  ["GitHub Foundations Certification", "GitHub", "Version control", 276, [
    "Repositories, branches and commit history",
    "Pull requests and code review flow",
    "Issues, Projects and team collaboration",
    "GitHub Actions and Codespaces basics"
  ]],
  ["IT Specialist JavaScript", "Certiport", "JavaScript", 780, [
    "Variables, data types and operators",
    "Functions, scope and closures",
    "DOM manipulation and event handling",
    "Debugging and error handling"
  ]],
  ["IT Specialist Python", "Certiport", "Python", 1530, [
    "Data types, operators and control flow",
    "Functions, modules and file input/output",
    "Lists, dictionaries and comprehensions",
    "Exception handling and troubleshooting"
  ]],
  ["IT Specialist HTML and CSS", "Certiport", "HTML and CSS", 672, [
    "Semantic document structure",
    "Selectors, the box model and layout",
    "Responsive design with media queries",
    "Forms, tables and accessibility basics"
  ]],
  ["Juniper Networks JNCIA-Junos (JN0-103) - Certified Associate", "Juniper Networks", "Routing and switching", 432, [
    "Junos OS architecture and the CLI",
    "Configuration hierarchy and commit model",
    "Routing policy and firewall filters",
    "Static and OSPF routing fundamentals"
  ]],
  ["Microsoft Office Specialist Excel Associate", "Microsoft", "Spreadsheet analysis", 456, [
    "Workbook and worksheet management",
    "Formulas, functions and cell references",
    "Tables, sorting and filtering",
    "Charts and conditional formatting"
  ]],
  ["Microsoft Azure AI Fundamentals", "Microsoft Azure", "Applied AI", 618, [
    "Responsible AI principles and practice",
    "Computer vision and OCR services",
    "Natural language and speech services",
    "Generative AI with Azure OpenAI"
  ]],
  ["Microsoft Azure Fundamentals", "Microsoft Azure", "Cloud foundations", 1728, [
    "Cloud concepts and service models",
    "Core Azure compute and storage services",
    "Identity, governance and compliance",
    "Cost management and service agreements"
  ]],
  ["MongoDB Certified Associate Developer", "MongoDB", "Document databases", 217, [
    "Document modelling and schema design",
    "CRUD operations and query operators",
    "Aggregation pipeline stages",
    "Indexing and driver integration"
  ]],
  ["Microsoft Technology Associate Database Fundamentals", "Microsoft", "Database fundamentals", 76, [
    "Relational concepts and normalisation",
    "Table design, keys and constraints",
    "SELECT, JOIN and data manipulation",
    "Backup, security and administration basics"
  ]],
  ["Microsoft Technology Associate HTML", "Microsoft", "HTML and CSS", 1404, [
    "Page structure with semantic tags",
    "Styling with selectors and inheritance",
    "The box model and positioning",
    "Forms, media and responsive basics"
  ]],
  ["Microsoft Technology Associate Java", "Microsoft", "Java", 852, [
    "Java syntax, data types and operators",
    "Control flow, loops and arrays",
    "Classes, objects and inheritance",
    "Exception handling and file input/output"
  ]],
  ["Microsoft Technology Associate Javascript", "Microsoft", "JavaScript", 1050, [
    "Syntax, variables and operators",
    "Decisions, loops and functions",
    "DOM interaction and event handling",
    "Form validation and error handling"
  ]],
  ["Microsoft Technology Associate Python", "Microsoft", "Python", 7689, [
    "Data types, operators and expressions",
    "Flow control with conditionals and loops",
    "Functions and module reuse",
    "File input/output and error handling"
  ]],
  ["Microsoft Technology Associate Security Fundamentals", "Microsoft", "Security fundamentals", 1116, [
    "Security layers and defence in depth",
    "Authentication, authorisation and accounting",
    "Network and host security controls",
    "Malware types and protection software"
  ]],
  ["Microsoft Certified Power BI Data Analyst", "Microsoft", "Data analytics", 64, [
    "Preparing and shaping data in Power Query",
    "Data modelling and relationships",
    "DAX measures and calculated columns",
    "Report design and workspace deployment"
  ]],
  ["Microsoft Certified Fabric Analytics Engineer Associate", "Microsoft Fabric", "Analytics engineering", 25, [
    "Lakehouse and warehouse design",
    "Ingestion with pipelines and dataflows",
    "Transformation with Spark and T-SQL",
    "Semantic models and workspace security"
  ]],
  ["Microsoft Certified Power Platform Fundamentals", "Power Platform", "Low-code applications", 417, [
    "Canvas and model-driven app basics",
    "Dataverse tables and relationships",
    "Cloud flows with Power Automate",
    "Power BI and Copilot Studio overview"
  ]],
  ["Microsoft Certified Power Platform Solution Architect", "Power Platform", "Solution architecture", 132, [
    "Requirements gathering and solution design",
    "Data model and integration architecture",
    "Security, ALM and environment strategy",
    "Performance, testing and go-live governance"
  ]],
  ["Oracle Cloud Infrastructure Foundations Associate", "Oracle", "Cloud infrastructure", 2490, [
    "Regions, compartments and IAM policy",
    "Compute, storage and networking basics",
    "Database and platform service catalogue",
    "Pricing, support and governance"
  ]],
  ["Oracle Foundation Associate Java", "Oracle", "Java foundations", 321, [
    "Java platform and program structure",
    "Variables, operators and control flow",
    "Classes, methods and object basics",
    "Arrays, strings and exception handling"
  ]],
  ["Oracle APEX Cloud Developer", "Oracle APEX", "Low-code development", 7, [
    "Declarative application and page creation",
    "SQL, PL/SQL and REST data sources",
    "Interactive reports and faceted search",
    "Authentication, authorisation and deployment"
  ]],
  ["Pega Certified System Architect", "Pega", "Business automation", 106, [
    "Case design and life-cycle modelling",
    "Data models and user interface config",
    "Process flows and decision rules",
    "Application debugging and testing"
  ]],
  ["Pega Certified Senior System Architect", "Pega", "Enterprise architecture", 103, [
    "Enterprise class structure design",
    "Reusable rules and application layering",
    "Integration with external systems",
    "Performance tuning and security models"
  ]],
  ["RedHat Certified System Administrator", "Red Hat", "Linux administration", 306, [
    "Shell essentials and file management",
    "Users, groups and permissions",
    "Storage, LVM and file systems",
    "systemd services, networking and SELinux"
  ]],
  ["Salesforce Certified Administrator", "Salesforce", "CRM administration", 82, [
    "Org setup, users and the security model",
    "Objects, fields and record types",
    "Automation with Flow and validation rules",
    "Reports, dashboards and data management"
  ]],
  ["Salesforce Certified Platform Developer I", "Salesforce", "Platform development", 79, [
    "Apex classes, triggers and unit testing",
    "SOQL, SOSL and DML operations",
    "Lightning Web Components",
    "Declarative versus programmatic design"
  ]],
  ["Servicenow Certified System Administrator", "ServiceNow", "IT service management", 125, [
    "User administration and access control",
    "Tables, forms and UI configuration",
    "Flow Designer and business rules",
    "Reporting, imports and instance upgrades"
  ]],
  ["Servicenow Certified Application Developer", "ServiceNow", "Application development", 117, [
    "Scoped application design",
    "Data models and table relationships",
    "Client and server-side scripting",
    "Application security and deployment"
  ]],
  ["Unity Certified User: Programmer", "Unity", "Real-time 3D", 108, [
    "C# scripting and the MonoBehaviour lifecycle",
    "GameObjects, components and prefabs",
    "Physics, collisions and input handling",
    "UI, debugging and build deployment"
  ]],];

/* The nineteen cohort folders. `key` is the folder name under
   "Certification Images  Sorted"; the display name and field are authored, and the
   four skills describe what that vendor's cards evidence as a group — one card is
   one cohort, so the credential it belongs to is the vendor's, not the photo's. */
const VENDORS = [
  ['aws', "AWS", "Cloud", [
    "Core services and global infrastructure",
    "Highly available multi-tier architectures",
    "IAM, KMS and the shared responsibility model",
    "Cost, billing and Well-Architected review"
  ]],
  ['microsoft', "Microsoft", "Cloud and data", [
    "Azure identity, networking and storage",
    "Responsible AI and Azure OpenAI",
    "Power BI modelling and DAX",
    "Power Platform apps and cloud flows"
  ]],
  ['google-cloud', "Google Cloud", "Cloud engineering", [
    "Project, IAM and billing configuration",
    "Compute Engine and GKE deployment",
    "Cloud Storage and managed databases",
    "Monitoring with the Operations Suite"
  ]],
  ['oracle', "Oracle", "Cloud and Java", [
    "Regions, compartments and IAM policy",
    "Compute, storage and networking basics",
    "Java syntax, classes and control flow",
    "Arrays, strings and exception handling"
  ]],
  ['redhat', "Red Hat", "Linux administration", [
    "Shell essentials and file management",
    "Users, groups and permissions",
    "Storage, LVM and file systems",
    "systemd, networking and SELinux"
  ]],
  ['cisco', "Cisco", "Networking", [
    "IPv4 and IPv6 addressing and subnetting",
    "Switching, VLANs and spanning tree",
    "OSPF and static routing",
    "Access control lists and network security"
  ]],
  ['juniper', "Juniper Networks", "Routing and switching", [
    "Junos OS architecture and the CLI",
    "Configuration hierarchy and commit model",
    "Routing policy and firewall filters",
    "Static and OSPF fundamentals"
  ]],
  ['pearson-it-specialist', "IT Specialist", "Programming and web", [
    "Python data types and control flow",
    "Java classes, objects and inheritance",
    "JavaScript functions and the DOM",
    "Semantic HTML and responsive CSS"
  ]],
  ['servicenow', "ServiceNow", "IT service management", [
    "User administration and access control",
    "Tables, forms and UI configuration",
    "Flow Designer and business rules",
    "Reporting, imports and upgrades"
  ]],
  ['pega', "Pega", "Business automation", [
    "Case design and life-cycle modelling",
    "Data models and user interface config",
    "Process flows and decision rules",
    "Reusable rules and application layering"
  ]],
  ['salesforce', "Salesforce", "CRM", [
    "Org setup, users and the security model",
    "Objects, fields and record types",
    "Automation with Flow and validation rules",
    "Reports, dashboards and data management"
  ]],
  ['automation-anywhere', "Automation Anywhere", "Robotic process automation", [
    "Recorder-based task automation",
    "Variables, loops and conditional logic",
    "Exception handling and error recovery",
    "Credential Vault and bot deployment"
  ]],
  ['postman', "Postman", "API development", [
    "Requests, collections and environments",
    "Writing tests and assertions",
    "Mock servers and documentation",
    "Project-based API delivery"
  ]],
  ['unity', "Unity", "Real-time 3D", [
    "C# scripting and the MonoBehaviour lifecycle",
    "GameObjects, components and prefabs",
    "Physics, collisions and input handling",
    "UI, debugging and build deployment"
  ]],
  ['arduino-iot', "Arduino", "Embedded and IoT", [
    "Reading schematics and breadboard wiring",
    "Sketch structure and control flow in C++",
    "Analog and digital sensor input",
    "PWM, motor and actuator control"
  ]],
  ['adobe', "Adobe", "Digital imaging", [
    "Non-destructive layers and masking",
    "Selections, compositing and retouching",
    "Colour correction with adjustment layers",
    "Export for print, web and mobile"
  ]],
  ['comptia', "CompTIA", "Security", [
    "Threats, attacks and vulnerabilities",
    "Identity and access management",
    "Cryptography fundamentals",
    "Risk and incident response"
  ]],
  ['mile2', "Mile2", "Security principles", [
    "Security governance and policy",
    "Network and host hardening",
    "Access control models",
    "Incident handling basics"
  ]],
  ['others', "Across the board", "Programme-wide", [

  ]],];

/* ------------------------------------------------------------------ utilities */

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const nf = (n) => Number(n || 0).toLocaleString('en-US');

/**
 * Read a .xlsx without a spreadsheet library.
 *
 * A workbook is a ZIP of XML. Only two members are needed — the shared string
 * table and the first sheet — so the central directory is walked, those two are
 * inflated, and the cells are pulled out with a regex. Numbers are stored inline;
 * strings are stored as an index into the shared table, which is why the table has
 * to be read first.
 */
function readWorkbook(file) {
  const buf = fs.readFileSync(file);
  const members = new Map();

  /* End-of-central-directory, then each entry. Scanning for the local file header
     signature instead would false-positive on compressed bytes. */
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error(`${path.basename(file)}: not a zip`);
  let at = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);

  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break;
    const method = buf.readUInt16LE(at + 10);
    const sizeC = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const offset = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);

    // The local header repeats the name and extra field, at its own lengths.
    const lNameLen = buf.readUInt16LE(offset + 26);
    const lExtraLen = buf.readUInt16LE(offset + 28);
    const start = offset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + sizeC);
    members.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    at += 46 + nameLen + extraLen + commentLen;
  }

  const strings = [];
  const shared = members.get('xl/sharedStrings.xml');
  if (shared) {
    const xml = shared.toString('utf8');
    for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
      // A styled cell splits its text across several <t> runs; join them all.
      strings.push((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
    }
  }

  const sheetName = [...members.keys()].find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k))
    || [...members.keys()].find((k) => /^xl\/worksheets\//.test(k));
  const sheet = members.get(sheetName);
  if (!sheet) throw new Error(`${path.basename(file)}: no worksheet`);

  const rows = [];
  for (const rowXml of sheet.toString('utf8').match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const cells = {};
    for (const cell of rowXml.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) || []) {
      const ref = /r="([A-Z]+)\d+"/.exec(cell)?.[1];
      if (!ref) continue;
      const type = /t="([^"]+)"/.exec(cell)?.[1];
      const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(cell)?.[1];
      if (type === 'inlineStr') {
        cells[ref] = (/<t[^>]*>([\s\S]*?)<\/t>/.exec(cell)?.[1] || '').replace(/<[^>]+>/g, '');
      } else if (type === 's') {
        cells[ref] = strings[Number(v)] ?? '';
      } else {
        cells[ref] = v ?? '';
      }
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Pixel dimensions from the file header.
 *
 * The wall packs justified rows from the real aspect ratios, so w/h has to travel
 * with the data — computing it after every image had loaded means a page that
 * visibly reflows. Only the header is read, never the pixels.
 */
function dimensions(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(64);
    fs.readSync(fd, head, 0, 64, 0);

    // PNG: IHDR is always the first chunk.
    if (head.readUInt32BE(0) === 0x89504e47) {
      return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
    }
    // GIF: logical screen descriptor, little-endian.
    if (head.toString('ascii', 0, 3) === 'GIF') {
      return { w: head.readUInt16LE(6), h: head.readUInt16LE(8) };
    }
    // WEBP: VP8 (lossy), VP8L (lossless) and VP8X (extended) each differ.
    if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
      const kind = head.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { w: (head.readUIntLE(24, 3) & 0xffffff) + 1, h: (head.readUIntLE(27, 3) & 0xffffff) + 1 };
      if (kind === 'VP8 ') return { w: head.readUInt16LE(26) & 0x3fff, h: head.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') {
        const bits = head.readUInt32LE(21);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
    }
    // JPEG: walk the segments to a start-of-frame. Length is big-endian and
    // excludes the marker, and the restart markers carry no length at all.
    if (head.readUInt16BE(0) === 0xffd8) {
      const size = fs.fstatSync(fd).size;
      const seg = Buffer.alloc(9);
      let at = 2;
      while (at < size - 9) {
        fs.readSync(fd, seg, 0, 9, at);
        if (seg[0] !== 0xff) { at += 1; continue; }
        const marker = seg[1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
        const len = seg.readUInt16BE(2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: seg.readUInt16BE(7), h: seg.readUInt16BE(5) };
        }
        at += 2 + len;
      }
    }
    // SVG has no raster size. A square keeps it in the packer without distorting it.
    if (path.extname(file).toLowerCase() === '.svg') return { w: 512, h: 512 };
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Is the file whole?
 *
 * A dimension check is not enough on its own. `others/DriveReady 10 Trainees
 * (PARTIAL DOWNLOAD).jpg` is 9.6kB of a much larger photograph: the header parses,
 * so it reports a size and sails through, and the wall ends up carrying a picture
 * that stops a third of the way down. A JPEG ends with the end-of-image marker and
 * a PNG with an IEND chunk, so the last bytes are what actually answer this.
 */
function isComplete(file) {
  const ext = path.extname(file).toLowerCase();
  const size = fs.statSync(file).size;
  if (!size) return false;
  const fd = fs.openSync(file, 'r');
  try {
    const tail = Buffer.alloc(Math.min(16, size));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    if (ext === '.jpg' || ext === '.jpeg') {
      // Some encoders pad with a trailing NUL or two; scan back over them.
      let i = tail.length - 1;
      while (i > 0 && tail[i] === 0x00) i -= 1;
      return tail[i - 1] === 0xff && tail[i] === 0xd9;
    }
    if (ext === '.png') return tail.includes('IEND');
    if (ext === '.gif') return tail[tail.length - 1] === 0x3b;
    // WEBP and SVG carry no end marker worth trusting; take them as they come.
    return true;
  } finally {
    fs.closeSync(fd);
  }
}

function request(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (cookie) headers.cookie = `op_session=${cookie}`;
    const req = http.request({ ...HOST, path: p, method, headers }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${method} ${p} -> ${res.statusCode} ${b.slice(0, 300)}`));
        let json = null;
        try { json = JSON.parse(b); } catch { /* empty body is fine */ }
        resolve({ json, setCookie: (res.headers['set-cookie'] || []).join(';') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* ---------------------------------------------------------------- the sources */

/* When the workbook renames an exam, name the pair here and the count flows again.
   Left as authored-name -> exact workbook name; the slug of each is compared, so
   punctuation and case do not matter. */
const ALIASES = {
  'Adobe Certified Professional Using Adobe Photoshop': 'Adobe Certified Professional in Visual Design Using Adobe Photoshop',
  'Arduino Fundamentals': 'Arduino Certification',
  'AutoCAD Certified User': 'Autodesk Certified User: AutoCAD',
  'Automation Anywhere Certified Advanced RPA Professional': 'Automation Anywhere Certified Advanced Automation Professional',
  'Automation Anywhere University Certified Essentials RPA Professional': 'Automation Anywhere Certified Essentials Automation Professional',
  'Cisco Certified CCNA': 'Cisco Certified Network Associate (CCNA)',
  'CISCO CyberOps Associate': 'Cisco Certified CyberOps Associate',
  'GitHub Foundations Certification': 'GitHub Foundations',
  'Juniper Networks JNCIA-Junos (JN0-103) - Certified Associate': 'Juniper Networks Certified Associate - Junos (JNCIA-Junos)',
  'Microsoft Office Specialist Excel Associate': 'Microsoft Office Specialist: Excel Associate (Microsoft 365 Apps)',
  'Microsoft Azure AI Fundamentals': 'Microsoft Certified: Azure AI Fundamentals',
  'Microsoft Azure Fundamentals': 'Microsoft Certified: Azure Fundamentals',
  'MongoDB Certified Associate Developer': 'MongoDB Associate Developer',
  'Microsoft Technology Associate Database Fundamentals': 'MTA: Database Fundamentals',
  'Microsoft Technology Associate HTML': 'MTA: Introduction to Programming Using HTML and CSS',
  'Microsoft Technology Associate Java': 'MTA: Introduction to Programming Using Java',
  'Microsoft Technology Associate Javascript': 'MTA: Introduction to Programming Using JavaScript',
  'Microsoft Technology Associate Python': 'MTA: Introduction to Programming Using Python',
  'Microsoft Technology Associate Security Fundamentals': 'MTA: Security Fundamentals',
  'Microsoft Certified Power BI Data Analyst': 'Microsoft Certified: Power BI Data Analyst Associate',
  'Microsoft Certified Power Platform Solution Architect': 'Microsoft Certified: Power Platform Solution Architect Expert',
  'Oracle Foundation Associate Java': 'Oracle Certified Foundations Associate, Java (Java Foundations)',
  'Oracle APEX Cloud Developer': 'Oracle APEX Cloud Developer Professional',
  'Pega Certified System Architect': 'Certified Pega System Architect (CPSA)',
  'Pega Certified Senior System Architect': 'Certified Pega Senior System Architect (CPSSA)',
  'RedHat Certified System Administrator': 'Red Hat Certified System Administrator (RHCSA)',
  'Salesforce Certified Administrator': 'Salesforce Certified Platform Administrator',
  'Salesforce Certified Platform Developer I': 'Salesforce Certified Platform Developer',
  'Servicenow Certified System Administrator': 'ServiceNow Certified System Administrator (CSA)',
  'Servicenow Certified Application Developer': 'ServiceNow Certified Application Developer (CAD)',

  /* Deliberately not aliased. The workbook carries "Microsoft Certified: Azure
     Administrator Associate" twice, at 660 and at 37, so there is no telling which
     is the cohort and which is a correction. Resolve it in the workbook — delete or
     rename the row that should not be there — and the exact join takes over. */
  // 'Azure Administrator Associate': 'Microsoft Certified: Azure Administrator Associate',
};

/**
 * Counts from the workbook, keyed by slug, plus every row it could not place.
 *
 * Joined exactly (or through ALIASES) and never approximately — see the note on
 * CREDENTIALS. A row the deck does not list is reported rather than dropped: it is
 * usually a new certification that wants adding to CREDENTIALS.
 */
function readCounts() {
  if (!fs.existsSync(WORKBOOK)) {
    console.log(`  ! ${path.relative(ROOT, WORKBOOK)} missing — every count falls back to the verified figure`);
    return { counts: new Map(), rows: [] };
  }
  const counts = new Map();
  const rows = [];
  const conflicts = new Map();
  for (const cells of readWorkbook(WORKBOOK)) {
    const name = String(cells.A || '').trim();
    const held = Number(String(cells.C ?? '').replace(/[^0-9.]/g, ''));
    if (!name || !Number.isFinite(held) || !held) continue;
    if (/certification\s*name/i.test(name)) continue;   // header row
    if (held > 100000) continue;                        // a stray 32767 sentinel
    const key = slug(name);
    const seen = counts.get(key);
    /* The same exam listed twice with two different numbers cannot be resolved
       here — last-write-wins would silently pick one. Drop it and say so. */
    if (seen !== undefined && seen !== Math.round(held)) {
      conflicts.set(key, [...(conflicts.get(key) || [seen]), Math.round(held)]);
      counts.delete(key);
    } else if (!conflicts.has(key)) {
      counts.set(key, Math.round(held));
    }
    rows.push({ name, held: Math.round(held) });
  }
  return { counts, rows, conflicts };
}

/** Words that appear in nearly every exam name, so they cannot tell two apart. */
const NOISE = new Set(['certified', 'certification', 'certifications', 'professional',
  'associate', 'user', 'fundamentals', 'specialist', 'certificate', 'the', 'in',
  'using', 'and', 'of', 'a']);

/** A suggestion only, printed next to an unmatched name to help write the alias. */
function nearest(name, rows) {
  const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter((w) => w && !NOISE.has(w)));
  const mine = words(name);
  let best = null;
  for (const row of rows) {
    const theirs = words(row.name);
    let shared = 0;
    for (const w of mine) if (theirs.has(w)) shared += 1;
    const score = shared / Math.max(1, Math.min(mine.size, theirs.size));
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= 0.5 ? best.row : null;
}

/** Badges, by slug, whatever extension they were downloaded as. */
function readBadges() {
  if (!fs.existsSync(BADGE_DIR)) return new Map();
  const found = new Map();
  for (const file of fs.readdirSync(BADGE_DIR)) {
    if (!/\.(png|jpe?g|webp|svg|gif)$/i.test(file)) continue;
    found.set(slug(path.basename(file, path.extname(file))), `certifications/badges/${file}`);
  }
  return found;
}

/** The cohort artwork, per vendor folder, with real pixel dimensions. */
function readCohorts() {
  const out = new Map();
  if (!fs.existsSync(COHORT_DIR)) return out;
  for (const key of fs.readdirSync(COHORT_DIR)) {
    const dir = path.join(COHORT_DIR, key);
    if (!fs.statSync(dir).isDirectory()) continue;
    const certs = [];
    for (const file of fs.readdirSync(dir).sort()) {
      if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) continue;
      const full = path.join(dir, file);
      const dim = dimensions(full);
      if (!dim) { console.log(`  ! unreadable header, skipped: ${key}/${file}`); continue; }
      /* Checked after the header, not instead of it — a truncated file usually has
         a perfectly good header, which is exactly why this is a separate test. */
      if (!isComplete(full)) { console.log(`  ! truncated file, skipped: ${key}/${file}`); continue; }
      certs.push({
        src: `certifications/${path.basename(COHORT_DIR)}/${key}/${file}`,
        label: path.basename(file, path.extname(file)).replace(/[_-]+/g, ' ').trim(),
        w: dim.w,
        h: dim.h,
      });
    }
    if (certs.length) out.set(key, certs);
  }
  return out;
}

/* ----------------------------------------------------------------- the block */

function buildBlock() {
  const { counts, rows, conflicts } = readCounts();
  const badges = readBadges();
  const cohorts = readCohorts();

  const refreshed = [];
  const stale = [];
  const claimed = new Set();

  const credentials = CREDENTIALS.map(([name, vendor, domain, verified, skills]) => {
    const alias = ALIASES[name];
    const key = counts.has(slug(name)) ? slug(name) : (alias ? slug(alias) : null);
    let held = verified;

    if (key && counts.has(key)) {
      claimed.add(key);
      const fromSheet = counts.get(key);
      if (fromSheet !== verified) refreshed.push({ name, was: verified, now: fromSheet });
      held = fromSheet;
    } else if (rows.length) {
      stale.push({ name, verified, guess: nearest(name, rows) });
    }

    return { name, vendor, domain, held, badge: badges.get(slug(name)) || '', skills };
  });

  const unlisted = rows.filter((r) => !claimed.has(slug(r.name)) && !conflicts.has(slug(r.name)));
  const doubled = [...conflicts.entries()].map(([key, values]) => ({
    name: rows.find((r) => slug(r.name) === key)?.name || key,
    values,
  }));

  const vendors = VENDORS
    .map(([key, name, domain, skills]) => ({ key, name, domain, skills, certs: cohorts.get(key) || [] }))
    .filter((v) => v.certs.length);

  const orphans = [...cohorts.keys()].filter((k) => !VENDORS.some(([key]) => key === k));

  return {
    block: {
      type: 'certification-wall',
      layout: LAYOUT,
      ...COPY,
      backdrop: fs.existsSync(path.join(UPLOADS, BACKDROP)) ? BACKDROP : '',
      credentials,
      vendors,
    },
    report: {
      refreshed,
      stale,
      doubled,
      unlisted,
      orphans,
      missingBadge: credentials.filter((c) => !c.badge).map((c) => c.name),
    },
  };
}

(async () => {
  const { block, report } = buildBlock();
  const earned = block.credentials.reduce((n, c) => n + c.held, 0);
  const cards = block.vendors.reduce((n, v) => n + v.certs.length, 0);

  console.log('Certifications');
  console.log(`  credentials   ${block.credentials.length}`);
  console.log(`  earned        ${nf(earned)}   (summed, never rounded)`);
  console.log(`  badges        ${block.credentials.filter((c) => c.badge).length} of ${block.credentials.length}`);
  console.log(`  vendors       ${block.vendors.length}`);
  console.log(`  cohort cards  ${cards}`);
  console.log(`  backdrop      ${block.backdrop || 'NONE'}`);

  if (report.refreshed.length) {
    console.log(`\n  counts the workbook moved (${report.refreshed.length}):`);
    report.refreshed.forEach((r) => console.log(`    ${nf(r.was).padStart(7)} -> ${nf(r.now).padStart(7)}  ${r.name}`));
  }
  if (report.stale.length) {
    console.log(`\n  no exact row in the workbook (${report.stale.length}) — verified figure kept.`);
    console.log('  add an ALIASES entry to let the workbook drive these:');
    report.stale.forEach((s) => console.log(`    ${nf(s.verified).padStart(7)}  ${s.name}`
      + (s.guess ? `\n             maybe: '${s.name}': '${s.guess.name}',   (${nf(s.guess.held)})` : '')));
  }
  if (report.doubled.length) {
    console.log(`\n  listed twice with different counts (${report.doubled.length}) — unusable until the workbook is fixed:`);
    report.doubled.forEach((d) => console.log(`    ${d.name}  ->  ${d.values.map(nf).join(' and ')}`));
  }
  if (report.unlisted.length) {
    console.log(`\n  workbook rows the deck does not list (${report.unlisted.length}) — add to CREDENTIALS to show them:`);
    report.unlisted.forEach((r) => console.log(`    ${nf(r.held).padStart(7)}  ${r.name}`));
  }
  if (report.missingBadge.length) {
    console.log(`\n  no badge on disk (${report.missingBadge.length}) — these fall back to type:`);
    report.missingBadge.forEach((n) => console.log(`    - ${n}`));
  }
  if (report.orphans.length) {
    console.log(`\n  cohort folders with no VENDORS entry (${report.orphans.length}) — add them or they stay dark:`);
    report.orphans.forEach((k) => console.log(`    - ${k}`));
  }

  if (DRY) {
    console.log('\n--dry-run: nothing published.');
    fs.writeFileSync(path.join(ROOT, 'certification-block.json'), JSON.stringify(block, null, 2));
    console.log('wrote certification-block.json for inspection.');
    return;
  }

  const login = await request('POST', '/api/auth/login', LOGIN);
  const token = /op_session=([^;]+)/.exec(login.setCookie)?.[1];
  if (!token) throw new Error('login returned no session cookie');

  const all = (await request('GET', `/api/orgs/${ORG}/sections`, null, token)).json.sections || [];
  const found = all.find((s) => s.key === SECTION_KEY && !s.parentId);
  if (found) {
    SECTION = found.id;
  } else {
    const made = await request('POST', `/api/orgs/${ORG}/sections`,
      { key: SECTION_KEY, title: SECTION_TITLE, status: 'draft' }, token);
    SECTION = (made.json.section || made.json).id;
    console.log(`
  created section ${SECTION}`);
  }

  /* The block id is preserved when there is one, so the section keeps its identity
     across re-publishes rather than being replaced with a new block each run. */
  const cur = await request('GET', `/api/sections/${SECTION}`, null, token);
  const existing = (cur.json.section || cur.json).blocks?.find((b) => b.type === 'certification-wall');
  if (existing?.id) block.id = existing.id;

  const saved = await request('PATCH', `/api/sections/${SECTION}`,
    { blocks: [block], status: 'published' }, token);
  const out = (saved.json.section || saved.json).blocks[0];

  console.log(`\npublished to ${SECTION}`);
  console.log(`  stored: ${out.credentials.length} credentials, ${out.vendors.length} vendors, `
    + `${out.vendors.reduce((n, v) => n + v.certs.length, 0)} cards`);

  /* The schema drops anything malformed silently, so a count that came back short
     means data was rejected — worth knowing now rather than on the projector. */
  if (out.credentials.length !== block.credentials.length) {
    console.log(`  ! ${block.credentials.length - out.credentials.length} credential(s) rejected by the schema`);
  }
  if (out.vendors.length !== block.vendors.length) {
    console.log(`  ! ${block.vendors.length - out.vendors.length} vendor(s) rejected by the schema`);
  }

  // Every referenced file must actually serve, or the deployed deck shows blanks.
  const sample = [block.backdrop, ...block.credentials.filter((c) => c.badge).slice(0, 3).map((c) => c.badge),
    ...block.vendors.slice(0, 3).map((v) => v.certs[0].src)].filter(Boolean);
  console.log('\nchecking a sample of the files serve…');
  for (const rel of sample) {
    const url = '/uploads/' + rel.split('/').map(encodeURIComponent).join('/');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => http.get({ ...HOST, path: url }, (r) => {
      console.log(`  ${r.statusCode}  ${rel}`);
      r.resume();
      r.on('end', res);
    }).on('error', (e) => { console.log(`  ERR  ${rel}  ${e.message}`); res(); }));
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
