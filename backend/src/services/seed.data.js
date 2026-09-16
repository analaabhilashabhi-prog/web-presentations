/**
 * Synthetic seed content for both organizations.
 *
 * Every company, college, person and number below is invented so a demo cannot
 * be mistaken for a real claim. The admin replaces this with real content.
 */

export const SEED = {
  torii: {
    meta: {
      name: 'Torii',
      shortName: 'Torii',
      tagline: 'STEP IN. STAND OUT.',
      founded: '2016',
      hq: 'Coimbatore, Tamil Nadu',
    },
    profile: {
      lead:
        'Torii is a talent transformation organization that prepares engineering and arts graduates for the roles industry is actually hiring for. We work inside campuses — not around them — running structured employability programs, assessment-led interventions and hiring drives on behalf of our recruiter network.',
      body:
        'Since 2016 we have built a delivery model that combines a structured learning platform, full-time trainers embedded on campus, and a recruiter desk that converts readiness into offers. Our engagements begin at the second year of study and continue through final placement, so departments can see measurable movement semester by semester.',
      bullets: [
        'Campus-embedded delivery teams, not visiting faculty',
        'Assessment-first design: baseline, midline and exit diagnostics for every learner',
        'A single recruiter desk serving all partner campuses',
        'Outcome reporting shared with the department every month',
      ],
      stats: [
        { value: 42000, suffix: '+', label: 'Learners trained' },
        { value: 128, suffix: '', label: 'Campus partners' },
        { value: 320, suffix: '+', label: 'Hiring partners' },
        { value: 96, suffix: '%', label: 'Program completion' },
      ],
    },
    ceo: {
      name: 'Arvind Balakrishnan',
      role: 'Founder & Chief Executive Officer',
      quote:
        'A degree opens the door. What we do at Torii is make sure the student walks through it standing tall — with the skills, the evidence and the confidence the room expects.',
      paragraphs: [
        'When we started Torii, campus training was largely a two-day event before placement season. We believed the opposite: readiness is built over semesters, and it is built with the department, not in spite of it.',
        'Every partnership we sign begins with the same question — what does this specific campus need that it does not have today? Sometimes it is coding depth, sometimes communication, sometimes simply the confidence to face a panel. Our programs are assembled around that answer.',
        'To the institutions considering us: we bring the platform, the trainers and the recruiters. What we ask for in return is access, honesty about where students stand, and a shared commitment to publish the outcome — good or bad. That is what makes a partnership worth signing.',
      ],
    },
    vision: {
      vision:
        'To be the bridge every ambitious student in a tier-2 or tier-3 campus can walk across into a career that changes their family\'s trajectory.',
      mission:
        'To deliver measurable employability inside partner campuses through structured programs, honest assessment and an active recruiter network.',
      values: [
        'Evidence over anecdote — every claim we make is backed by an assessment record',
        'The student is the customer, even when the institution is the client',
        'Publish outcomes, including the ones that disappoint us',
        'Trainers who have shipped work, not just taught it',
        'Respect the academic calendar — we fit around learning, never disrupt it',
      ],
    },
    bestPractices: [
      {
        title: 'Baseline before curriculum',
        body:
          'No program is finalised until a diagnostic is run on the actual cohort. Two campuses with identical CGPA profiles routinely need different interventions.',
      },
      {
        title: 'Trainer-to-learner ceiling of 1:35',
        body:
          'Batches are capped so that every learner receives reviewed work each week. Above 35 the review loop collapses, and with it the outcome.',
      },
      {
        title: 'Weekly evidence pack to the department',
        body:
          'Attendance, assessment movement and at-risk learners go to the placement officer every Friday. No surprises at the end of the semester.',
      },
      {
        title: 'Mock panels staffed by recruiters',
        body:
          'Interview practice is run by people who hire for a living, so feedback reflects the real bar rather than a checklist.',
      },
      {
        title: 'Content refresh every six months',
        body:
          'Modules are versioned and retired on a fixed cycle, driven by what our recruiter desk reports from live hiring rounds.',
      },
      {
        title: 'One accountable owner per campus',
        body:
          'Each partnership has a named program manager. Escalation never requires explaining the context twice.',
      },
    ],
    programs: [
      {
        title: 'Full Stack Engineering Track',
        category: 'Software Engineering',
        duration: '180 hours',
        level: 'Intermediate',
        summary:
          'Project-driven path from language fundamentals to a deployed multi-service application, reviewed at every milestone.',
        modules: ['JavaScript Core', 'React Fundamentals', 'API Design', 'Databases', 'Testing', 'Deployment'],
      },
      {
        title: 'Problem Solving & DSA Intensive',
        category: 'Aptitude & Coding',
        duration: '120 hours',
        level: 'All levels',
        summary:
          'Structured progression through data structures with weekly timed contests mapped to recruiter difficulty bands.',
        modules: ['Arrays & Strings', 'Recursion', 'Trees & Graphs', 'Dynamic Programming', 'Contest Practice'],
      },
      {
        title: 'Data & Analytics Foundation',
        category: 'Data',
        duration: '96 hours',
        level: 'Beginner',
        summary:
          'SQL, spreadsheet modelling and Python analysis built around a capstone using a realistic business dataset.',
        modules: ['SQL', 'Python for Analysis', 'Visualisation', 'Statistics', 'Capstone'],
      },
      {
        title: 'Communication & Interview Readiness',
        category: 'Professional Skills',
        duration: '64 hours',
        level: 'All levels',
        summary:
          'Spoken fluency, structured answering and panel practice, with recorded mock interviews and written feedback.',
        modules: ['Spoken Fluency', 'Group Discussion', 'Resume Clinic', 'Mock Panels'],
      },
      {
        title: 'Cloud & DevOps Essentials',
        category: 'Infrastructure',
        duration: '80 hours',
        level: 'Intermediate',
        summary:
          'Containers, pipelines and observability taught through an always-running class deployment students maintain.',
        modules: ['Linux', 'Docker', 'CI/CD', 'Monitoring', 'Cloud Basics'],
      },
      {
        title: 'Core Engineering Bridge',
        category: 'Non-IT Branches',
        duration: '110 hours',
        level: 'Beginner',
        summary:
          'For mechanical, civil and EEE cohorts: design tooling, quality systems and manufacturing-role interview preparation.',
        modules: ['CAD Practice', 'Quality Systems', 'Manufacturing Processes', 'Role Mapping'],
      },
    ],
    team: [
      { name: 'Arvind Balakrishnan', role: 'Founder & CEO', focus: 'Partnerships & strategy', tags: ['Leadership'] },
      { name: 'Meera Krishnan', role: 'Head of Academics', focus: 'Curriculum design & trainer certification', tags: ['Curriculum'] },
      { name: 'Rahul Devanathan', role: 'Lead Trainer — Full Stack', focus: 'Web engineering, code review practice', tags: ['React', 'Node'] },
      { name: 'Sowmya Raghavan', role: 'Lead Trainer — Data', focus: 'SQL, Python, analytics capstones', tags: ['SQL', 'Python'] },
      { name: 'Imran Sheikh', role: 'Head of Recruiter Relations', focus: 'Hiring partner network & drives', tags: ['Placements'] },
      { name: 'Divya Nair', role: 'Communication Coach', focus: 'Fluency labs and panel readiness', tags: ['Soft skills'] },
      { name: 'Karthik Subramani', role: 'Program Manager — Campus', focus: 'Delivery governance across 40 campuses', tags: ['Delivery'] },
      { name: 'Anjali Menon', role: 'Assessment Lead', focus: 'Diagnostics, item banking, reporting', tags: ['Assessment'] },
    ],
    initiatives: [
      {
        title: 'First Graduate Scholarship',
        body: 'Full program fee waiver for 200 first-generation graduates each academic year, selected by diagnostic score and need.',
        meta: 'Running since 2019',
      },
      {
        title: 'Trainer Fellowship',
        body: 'A six-month paid fellowship converting strong final-year students into certified junior trainers on their own campus.',
        meta: '48 fellows to date',
      },
      {
        title: 'Rural Campus Outreach',
        body: 'Subsidised delivery for institutions more than 80km from a metro, including offline-capable course material.',
        meta: '22 campuses covered',
      },
      {
        title: 'Women in Engineering Circle',
        body: 'Mentor pairing, returnship guidance and a dedicated interview clinic run with women engineers from our recruiter network.',
        meta: '1,400 participants',
      },
    ],
    initiativeGallery: [
      { label: 'Scholarship Cohort Induction', sub: 'First Graduate Scholarship, 2025 intake' },
      { label: 'Trainer Fellowship Bootcamp', sub: 'Certification week' },
      { label: 'Rural Outreach Van', sub: 'Offline lab delivery' },
      { label: 'Women in Engineering Circle', sub: 'Mentor pairing session' },
      { label: 'Community Coding Sunday', sub: 'Open practice contest' },
    ],
    certifications: [
      { title: 'Torii Certified Full Stack Associate', meta: 'Proctored · 3 hours', body: 'Live coding plus system walkthrough, graded by two reviewers against a published rubric.' },
      { title: 'Torii Certified Data Associate', meta: 'Proctored · 2.5 hours', body: 'SQL, analysis notebook and stakeholder summary, assessed end to end.' },
      { title: 'Problem Solving Level II', meta: 'Contest-based', body: 'Awarded on sustained contest performance across a semester, not a single test.' },
      { title: 'Professional Communication Level I', meta: 'Panel assessed', body: 'Structured answering, group discussion and presentation, rated by external panellists.' },
      { title: 'Cloud Practitioner Readiness', meta: 'Practice-aligned', body: 'Prepares and validates readiness for entry-level public cloud certification.' },
      { title: 'Certified Campus Trainer', meta: 'Fellowship exit', body: 'Internal credential for fellows who complete supervised teaching hours.' },
    ],
    placements: {
      stats: [
        { value: 7840, suffix: '', label: 'Offers facilitated' },
        { value: 320, suffix: '+', label: 'Hiring partners' },
        { value: 84, suffix: '%', label: 'Placement conversion' },
        { value: 12, prefix: '₹', suffix: 'L', label: 'Highest package' },
      ],
      entries: [
        { company: 'Nexora Systems', role: 'Software Engineer', offers: 62, pkg: '₹6.5L' },
        { company: 'Vantiq Labs', role: 'Associate Developer', offers: 48, pkg: '₹5.2L' },
        { company: 'Aurevia Tech', role: 'QA Engineer', offers: 55, pkg: '₹4.8L' },
        { company: 'Zentrix Digital', role: 'Frontend Engineer', offers: 37, pkg: '₹7.0L' },
        { company: 'Helion Software', role: 'Graduate Engineer Trainee', offers: 90, pkg: '₹4.2L' },
        { company: 'Quantiva Analytics', role: 'Data Analyst', offers: 29, pkg: '₹6.8L' },
        { company: 'Northwind IT Services', role: 'Support Engineer', offers: 74, pkg: '₹3.9L' },
        { company: 'Skybridge Robotics', role: 'Automation Engineer', offers: 21, pkg: '₹8.4L' },
        { company: 'Meridian Cloud', role: 'Cloud Associate', offers: 33, pkg: '₹7.6L' },
        { company: 'Orbtek Semiconductors', role: 'Design Trainee', offers: 18, pkg: '₹9.2L' },
        { company: 'Larkspur Fintech', role: 'Backend Engineer', offers: 26, pkg: '₹12.0L' },
        { company: 'Cygnet Automation', role: 'Embedded Engineer', offers: 24, pkg: '₹6.1L' },
      ],
    },
    coe: {
      lead:
        'Our Centres of Excellence are physical labs inside partner campuses, co-branded and jointly governed. Each centre carries a fixed equipment standard, a resident trainer and a published utilisation report.',
      centres: [
        { title: 'Full Stack Studio', meta: '4 centres', body: '30-seat lab with review stations and a permanent staging deployment maintained by students.' },
        { title: 'Data & AI Lab', meta: '3 centres', body: 'GPU-backed workstations for analytics and applied machine learning capstones.' },
        { title: 'Communication Studio', meta: '6 centres', body: 'Recording booths and panel rooms for mock interviews with playback review.' },
        { title: 'Automation Workshop', meta: '2 centres', body: 'PLC and robotics benches for core-branch students moving into automation roles.' },
      ],
      gallery: [
        { label: 'Full Stack Studio', sub: 'Coimbatore centre' },
        { label: 'Data & AI Lab', sub: 'Workstation bay' },
        { label: 'Communication Studio', sub: 'Panel room' },
        { label: 'Automation Workshop', sub: 'Robotics bench' },
        { label: 'Review Stations', sub: 'Weekly code review' },
        { label: 'Contest Arena', sub: 'Timed practice hall' },
        { label: 'Recruiter Lounge', sub: 'On-campus drive room' },
      ],
    },
    mous: {
      lead:
        'An MOU with Torii is a two-year, renewable agreement covering program delivery, a co-branded centre where applicable, recruiter access and a shared outcome report. Signing is a department-level decision and we start with a single cohort.',
      whatWeBring: [
        'Structured programs mapped to your academic calendar',
        'Resident trainers and a named program manager',
        'Access to the full recruiter desk and on-campus drives',
        'Assessment platform licences for every enrolled student',
        'Monthly outcome reporting to the department and management',
      ],
      whatWeAsk: [
        'Lab and classroom access on agreed slots',
        'A single point of contact from the placement cell',
        'Permission to publish anonymised outcome data',
      ],
      partners: [
        { name: 'Sri Aravind Institute of Technology', type: 'Engineering College', since: 'Jun 2021', scope: 'Full stack track, Centre of Excellence, campus drives' },
        { name: 'KPR Valley College of Engineering', type: 'Autonomous Institution', since: 'Aug 2020', scope: 'DSA intensive and placement readiness for CSE and IT' },
        { name: 'Vellore Crest University', type: 'Deemed University', since: 'Jan 2022', scope: 'Data analytics foundation across three schools' },
        { name: 'Kaveri Arts & Science College', type: 'Arts & Science', since: 'Jul 2022', scope: 'Communication and business analytics tracks' },
        { name: 'Nilgiri Institute of Engineering', type: 'Engineering College', since: 'Mar 2023', scope: 'Core engineering bridge and automation workshop' },
        { name: 'Madurai Technological Academy', type: 'Polytechnic', since: 'Sep 2023', scope: 'Diploma-to-industry pathway programme' },
        { name: 'Coastal Ridge Engineering College', type: 'Engineering College', since: 'Feb 2024', scope: 'Cloud and DevOps essentials, recruiter drives' },
        { name: 'Sanghamitra Women\'s College', type: 'Women\'s Institution', since: 'Nov 2024', scope: 'Women in Engineering Circle and full stack studio' },
      ],
      stats: [
        { value: 128, suffix: '', label: 'Active MOUs' },
        { value: 15, suffix: '', label: 'Co-branded centres' },
        { value: 92, suffix: '%', label: 'Renewal rate' },
        { value: 9, suffix: '', label: 'States covered' },
      ],
    },
    moments: [
      { label: 'Torii Annual Summit', sub: 'Chennai · 2025' },
      { label: 'Hackathon 36', sub: '36-hour build sprint' },
      { label: 'Recruiter Day', sub: '18 companies on campus' },
      { label: 'Scholarship Awards', sub: 'First Graduate cohort' },
      { label: 'Centre Inauguration', sub: 'Nilgiri Institute' },
      { label: 'Trainer Fellowship Graduation', sub: 'Batch 06' },
      { label: 'Alumni Homecoming', sub: 'Class of 2022' },
      { label: 'Industry Panel', sub: 'Hiring bar, unfiltered' },
      { label: 'Contest Finals', sub: 'Inter-campus championship' },
    ],
    achievements: [
      { title: 'Skilling Partner of the Year', meta: '2024 · South India Skills Forum', body: 'Recognised for measured employability gains across tier-2 campuses.' },
      { title: '40,000 Learners Milestone', meta: '2025', body: 'Crossed forty thousand trained learners since inception.' },
      { title: 'Best Campus Programme', meta: '2023 · Regional Education Council', body: 'Awarded for the assessment-first delivery model.' },
      { title: 'Great Place to Learn', meta: '2024', body: 'Independent learner satisfaction survey score of 4.6 out of 5.' },
      { title: 'Inclusion Award', meta: '2025', body: 'For the Women in Engineering Circle and rural outreach programme.' },
      { title: 'ISO 9001:2015 Certified', meta: 'Since 2021', body: 'Quality management certification covering training delivery.' },
    ],
    media: [
      { label: 'Summit Keynote', sub: 'Main hall' },
      { label: 'Lab in Session', sub: 'Full stack studio' },
      { label: 'Panel Discussion', sub: 'Industry voices' },
      { label: 'Campus Drive', sub: 'Recruiter day' },
      { label: 'Mock Interview', sub: 'Communication studio' },
      { label: 'Contest Hall', sub: 'Timed round' },
      { label: 'Award Night', sub: 'Skilling Partner of the Year' },
      { label: 'Centre Tour', sub: 'Management visit' },
      { label: 'Fellowship Batch', sub: 'Graduation day' },
      { label: 'Alumni Meet', sub: 'Class of 2022' },
    ],
    testimonials: [
      { text: 'The difference was visible in the second semester itself. Our students stopped freezing in technical rounds, and the weekly report meant we always knew who needed help.', author: 'Dr. Lakshmi Venkatesan', role: 'Principal, Sri Aravind Institute of Technology' },
      { text: 'I came from a Tamil-medium school and could not speak for two minutes in front of a class. Fourteen months later I cleared four interviews and joined as a backend engineer.', author: 'Praveen Kumar', role: 'Alumnus, 2024 batch' },
      { text: 'We hire from Torii campuses because the shortlist is honest. If the report says a student is ready, the interview confirms it.', author: 'Nithya Raman', role: 'Talent Acquisition Lead, Larkspur Fintech' },
    ],
    contact: {
      lead: 'Talk to our partnerships team about an MOU, a pilot cohort or a campus visit. We respond to institutional enquiries within two working days.',
      offices: [
        { title: 'Head Office', subtitle: 'Coimbatore', body: '4th Floor, Saravana Tech Park, Avinashi Road, Coimbatore 641014' },
        { title: 'Chennai Office', subtitle: 'Regional', body: 'Unit 12, Guindy Industrial Estate, Chennai 600032' },
        { title: 'Bengaluru Desk', subtitle: 'Recruiter relations', body: '2nd Floor, Jayanagar 4th Block, Bengaluru 560011' },
      ],
      lines: [
        'Partnerships: partnerships@torii.example',
        'Recruiter desk: hiring@torii.example',
        'Phone: +91 90000 12345',
        'Office hours: Monday to Saturday, 9:30am to 6:30pm IST',
      ],
    },
  },

  'technical-hub': {
    meta: {
      name: 'Technical Hub',
      shortName: 'Tech Hub',
      tagline: 'ENGINEERING DEPTH, INDUSTRY READY.',
      founded: '2014',
      hq: 'Hyderabad, Telangana',
    },
    profile: {
      lead:
        'Technical Hub builds core engineering capability. We run deep-tech laboratories, certified training tracks and product-grade capstone projects with engineering institutions that want their students working on real hardware and real systems.',
      body:
        'Our work sits where classroom theory meets a bench: embedded systems, VLSI, robotics, IoT and industrial automation, alongside modern software and AI tracks. Each partnership includes lab setup, faculty enablement and a project pipeline reviewed by practising engineers.',
      bullets: [
        'Laboratory-first delivery across nine technology domains',
        'Faculty development built into every institutional agreement',
        'Product-grade capstones with documented design reviews',
        'Industry mentors assigned per project team',
      ],
      stats: [
        { value: 36500, suffix: '+', label: 'Students trained' },
        { value: 210, suffix: '', label: 'Institutional partners' },
        { value: 64, suffix: '', label: 'Labs commissioned' },
        { value: 11, suffix: '', label: 'Years of delivery' },
      ],
    },
    ceo: {
      name: 'Dr. Srinivas Reddy',
      role: 'Managing Director',
      quote:
        'An engineer is made at a workbench, not at a whiteboard. Our job is to put the bench in front of the student and stay in the room while they use it.',
      paragraphs: [
        'Technical Hub began with a single embedded systems lab and a conviction that core branches were being left behind by the skilling industry. Eleven years later that conviction still sets our roadmap.',
        'We measure ourselves on artefacts, not attendance. Every cohort we run has to leave behind something that works — a board that boots, a controller that holds tolerance, a model that ships. Faculty are trained alongside students so the capability stays on campus after we leave.',
        'For institutions evaluating a partnership: we will tell you honestly whether your lab, your calendar and your student profile can support a given track. Where they cannot yet, we will propose the smaller step that gets you there.',
      ],
    },
    vision: {
      vision:
        'To make every partner institution a place where an engineering student can build something real before graduating.',
      mission:
        'To commission laboratories, enable faculty and deliver project-based technical training that produces demonstrable engineering capability.',
      values: [
        'Working artefacts are the only proof of learning',
        'Train the faculty, not just the batch — capability must remain on campus',
        'Safety and standards discipline in every lab, without exception',
        'Depth before breadth: one domain done properly beats five sampled',
        'Transparent equipment costing, with no bundled surprises',
      ],
    },
    bestPractices: [
      {
        title: 'Lab readiness audit before signing',
        body: 'Power, space, safety and network are inspected and documented first. We decline tracks a lab cannot yet support rather than dilute them.',
      },
      {
        title: 'Faculty cohort runs one module ahead',
        body: 'Partner faculty complete each module before the student batch reaches it, so support is available between our sessions.',
      },
      {
        title: 'Design review gates',
        body: 'Capstones pass three reviews — concept, build and validation — each signed off by an industry mentor.',
      },
      {
        title: 'Fixed bill of materials',
        body: 'Every lab has a published component list with open pricing, so institutions can audit spend and reorder independently.',
      },
      {
        title: 'Safety certification for every learner',
        body: 'No student touches a powered bench before completing lab safety certification. Records are held with the department.',
      },
      {
        title: 'Equipment handover with documentation',
        body: 'Labs are handed over with wiring diagrams, spares list and a maintenance calendar — not just cartons.',
      },
    ],
    programs: [
      {
        title: 'Embedded Systems & Firmware',
        category: 'Embedded',
        duration: '160 hours',
        level: 'Intermediate',
        summary: 'Bare-metal to RTOS firmware development on ARM boards, ending in a validated custom board bring-up.',
        modules: ['C for Embedded', 'ARM Architecture', 'Peripherals', 'RTOS', 'Board Bring-up', 'Validation'],
      },
      {
        title: 'VLSI Design & Verification',
        category: 'Semiconductor',
        duration: '180 hours',
        level: 'Advanced',
        summary: 'RTL design, functional verification and synthesis flow using an industry-standard toolchain.',
        modules: ['Digital Design', 'Verilog', 'SystemVerilog', 'UVM Basics', 'Synthesis', 'Timing'],
      },
      {
        title: 'Industrial Automation & PLC',
        category: 'Automation',
        duration: '120 hours',
        level: 'Intermediate',
        summary: 'Ladder logic, SCADA and motion control on a working conveyor and sorting rig.',
        modules: ['PLC Programming', 'HMI & SCADA', 'Sensors', 'Motion Control', 'Line Commissioning'],
      },
      {
        title: 'Robotics & Mechatronics',
        category: 'Robotics',
        duration: '140 hours',
        level: 'Intermediate',
        summary: 'Kinematics, actuation and ROS-based control, built up to an autonomous mobile robot.',
        modules: ['Kinematics', 'Actuators', 'ROS Basics', 'Perception', 'Autonomy Project'],
      },
      {
        title: 'IoT Systems Engineering',
        category: 'IoT',
        duration: '110 hours',
        level: 'Beginner',
        summary: 'Sensor nodes to cloud dashboards, with power budgeting and field reliability treated as first-class topics.',
        modules: ['Sensor Nodes', 'Protocols', 'Edge Processing', 'Cloud Dashboards', 'Field Trial'],
      },
      {
        title: 'Applied AI for Engineering',
        category: 'AI & Data',
        duration: '130 hours',
        level: 'Intermediate',
        summary: 'Machine learning applied to signals, vision and predictive maintenance datasets from industrial settings.',
        modules: ['Python & NumPy', 'Signal Features', 'Computer Vision', 'Model Deployment', 'Edge Inference'],
      },
    ],
    team: [
      { name: 'Dr. Srinivas Reddy', role: 'Managing Director', focus: 'Institutional partnerships, technology roadmap', tags: ['Leadership'] },
      { name: 'Padmaja Iyer', role: 'Head of Laboratories', focus: 'Lab design, commissioning, safety standards', tags: ['Labs'] },
      { name: 'Vikram Chauhan', role: 'Principal Engineer — VLSI', focus: 'RTL design and verification tracks', tags: ['Verilog', 'UVM'] },
      { name: 'Bhavana Rao', role: 'Lead Engineer — Embedded', focus: 'Firmware, board bring-up, RTOS', tags: ['ARM', 'RTOS'] },
      { name: 'Joseph Mathew', role: 'Lead Engineer — Automation', focus: 'PLC, SCADA and line commissioning', tags: ['PLC', 'SCADA'] },
      { name: 'Sneha Patil', role: 'Robotics Specialist', focus: 'ROS, perception and autonomy capstones', tags: ['ROS'] },
      { name: 'Ganesh Kulkarni', role: 'Faculty Development Lead', focus: 'Faculty enablement and certification', tags: ['FDP'] },
      { name: 'Ritu Bansal', role: 'Head of Industry Projects', focus: 'Mentor network and design review gates', tags: ['Projects'] },
    ],
    initiatives: [
      { title: 'Faculty Development Series', body: 'Free six-day residential programmes for partner faculty across embedded, VLSI and automation domains.', meta: '1,900 faculty trained' },
      { title: 'Open Lab Saturdays', body: 'Partner campus labs opened to nearby polytechnic and school students under supervision.', meta: '38 campuses participating' },
      { title: 'Final Year Project Fund', body: 'Component grants of up to ₹40,000 for project teams whose proposals clear the design review panel.', meta: '260 projects funded' },
      { title: 'Girls in Core Engineering', body: 'Targeted lab access, mentoring and internship placement for women in mechanical, EEE and ECE branches.', meta: '850 participants' },
    ],
    initiativeGallery: [
      { label: 'Faculty Development Series', sub: 'Embedded systems cohort' },
      { label: 'Open Lab Saturday', sub: 'Visiting polytechnic students' },
      { label: 'Project Fund Review', sub: 'Design review panel' },
      { label: 'Girls in Core Engineering', sub: 'Mentoring session' },
      { label: 'Community Build Day', sub: 'Robotics workshop' },
    ],
    certifications: [
      { title: 'Certified Embedded Engineer', meta: 'Bench assessed · 4 hours', body: 'Candidates bring up a board and demonstrate a working peripheral driver under observation.' },
      { title: 'Certified VLSI Verification Associate', meta: 'Tool-based · 4 hours', body: 'Write and defend a testbench against a supplied specification.' },
      { title: 'Automation Technician Level II', meta: 'Rig assessed', body: 'Commission a sorting line on live hardware within a fixed time window.' },
      { title: 'IoT Systems Practitioner', meta: 'Project assessed', body: 'Deploy and defend a field-tested sensor-to-dashboard system.' },
      { title: 'Robotics Integrator Certificate', meta: 'Capstone assessed', body: 'Awarded on a validated autonomous navigation demonstration.' },
      { title: 'Lab Safety Certification', meta: 'Mandatory · 6 hours', body: 'Prerequisite for all powered bench work, recorded with the department.' },
    ],
    placements: {
      stats: [
        { value: 5210, suffix: '', label: 'Students placed' },
        { value: 180, suffix: '+', label: 'Recruiting companies' },
        { value: 78, suffix: '%', label: 'Core-branch placement' },
        { value: 14, prefix: '₹', suffix: 'L', label: 'Highest package' },
      ],
      entries: [
        { company: 'Orbtek Semiconductors', role: 'Design Engineer', offers: 34, pkg: '₹9.5L' },
        { company: 'Skybridge Robotics', role: 'Robotics Engineer', offers: 28, pkg: '₹8.8L' },
        { company: 'Cygnet Automation', role: 'Automation Engineer', offers: 46, pkg: '₹6.4L' },
        { company: 'Voltway Energy', role: 'Embedded Engineer', offers: 31, pkg: '₹7.2L' },
        { company: 'Ferrolane Manufacturing', role: 'Graduate Engineer Trainee', offers: 72, pkg: '₹4.6L' },
        { company: 'Nexora Systems', role: 'Firmware Engineer', offers: 25, pkg: '₹10.5L' },
        { company: 'Trilytic Instruments', role: 'Test Engineer', offers: 19, pkg: '₹5.8L' },
        { company: 'Meridian Cloud', role: 'IoT Platform Engineer', offers: 22, pkg: '₹8.1L' },
        { company: 'Steelgrove Industries', role: 'Maintenance Engineer', offers: 38, pkg: '₹4.9L' },
        { company: 'Arcline Motors', role: 'Vehicle Electronics Engineer', offers: 27, pkg: '₹7.9L' },
        { company: 'Quantiva Analytics', role: 'ML Engineer', offers: 16, pkg: '₹14.0L' },
        { company: 'Helion Software', role: 'Verification Engineer', offers: 21, pkg: '₹11.2L' },
      ],
    },
    coe: {
      lead:
        'Each Centre of Excellence is a commissioned laboratory with a fixed equipment standard, a resident engineer, a documented safety protocol and a maintenance calendar handed over to the department.',
      centres: [
        { title: 'Embedded Systems CoE', meta: '18 centres', body: 'ARM development benches, logic analysers and board bring-up stations.' },
        { title: 'VLSI Design CoE', meta: '9 centres', body: 'Licensed EDA workstations with synthesis and verification flows.' },
        { title: 'Industrial Automation CoE', meta: '14 centres', body: 'PLC racks, SCADA terminals and a working conveyor rig.' },
        { title: 'Robotics & Drone CoE', meta: '12 centres', body: 'Mobile robot platforms, motion capture area and drone cage.' },
        { title: 'IoT & Edge CoE', meta: '11 centres', body: 'Sensor node kits, gateway hardware and an on-premise dashboard stack.' },
      ],
      gallery: [
        { label: 'Embedded Systems CoE', sub: 'Bring-up benches' },
        { label: 'VLSI Design CoE', sub: 'EDA workstations' },
        { label: 'Industrial Automation CoE', sub: 'Conveyor rig' },
        { label: 'Robotics & Drone CoE', sub: 'Drone cage' },
        { label: 'IoT & Edge CoE', sub: 'Gateway rack' },
        { label: 'Instrumentation Bay', sub: 'Calibration corner' },
        { label: 'Project Assembly Area', sub: 'Capstone builds' },
      ],
    },
    mous: {
      lead:
        'A Technical Hub MOU covers laboratory commissioning, faculty development, student training tracks and the industry project pipeline. Agreements run three years, with an annual equipment and outcome review.',
      whatWeBring: [
        'Lab design, commissioning and documented handover',
        'Faculty development programmes at no additional cost',
        'Certified training tracks aligned to the university syllabus',
        'Industry mentors for capstone design reviews',
        'Annual equipment audit and maintenance plan',
      ],
      whatWeAsk: [
        'Dedicated lab space meeting the readiness audit',
        'Faculty nominations for the enablement cohort',
        'Departmental sign-off on the academic calendar slots',
      ],
      partners: [
        { name: 'Deccan Institute of Engineering', type: 'Engineering College', since: 'Jul 2018', scope: 'Embedded and VLSI Centres of Excellence' },
        { name: 'Godavari University', type: 'State University', since: 'Feb 2019', scope: 'Automation CoE across two constituent colleges' },
        { name: 'Kakatiya Technical Institute', type: 'Autonomous Institution', since: 'Aug 2020', scope: 'Robotics CoE and faculty development' },
        { name: 'Sagar Valley College of Technology', type: 'Engineering College', since: 'Jan 2021', scope: 'IoT and edge computing track' },
        { name: 'Nallamala Polytechnic', type: 'Polytechnic', since: 'Jun 2022', scope: 'Automation technician pathway' },
        { name: 'Bhagirathi Women\'s Engineering College', type: 'Women\'s Institution', since: 'Mar 2023', scope: 'Girls in Core Engineering, embedded lab' },
        { name: 'Warangal Crest University', type: 'Deemed University', since: 'Sep 2023', scope: 'Applied AI for engineering, project fund' },
        { name: 'Coromandel Institute of Technology', type: 'Engineering College', since: 'Dec 2024', scope: 'VLSI verification track and mentoring' },
      ],
      stats: [
        { value: 210, suffix: '', label: 'Active MOUs' },
        { value: 64, suffix: '', label: 'Centres commissioned' },
        { value: 88, suffix: '%', label: 'Renewal rate' },
        { value: 12, suffix: '', label: 'States covered' },
      ],
    },
    moments: [
      { label: 'National Tech Expo', sub: 'Hyderabad · 2025' },
      { label: 'Robotics Championship', sub: 'Inter-college finals' },
      { label: 'Lab Commissioning', sub: 'Godavari University' },
      { label: 'Faculty Development Series', sub: 'Batch 22' },
      { label: 'Drone Trials', sub: 'Open field testing' },
      { label: 'Semiconductor Workshop', sub: 'Industry-led session' },
      { label: 'Project Fund Awards', sub: 'Design review winners' },
      { label: 'Industry Visit', sub: 'Manufacturing floor tour' },
      { label: 'Alumni Engineers Meet', sub: 'Class of 2021' },
    ],
    achievements: [
      { title: 'Best Technical Training Partner', meta: '2024 · Telangana Industry Council', body: 'For laboratory commissioning quality and faculty enablement scale.' },
      { title: '200th MOU Signed', meta: '2025', body: 'Crossed two hundred active institutional partnerships.' },
      { title: 'Innovation in Skilling', meta: '2022 · National Skills Summit', body: 'Awarded for the design review gate model on student capstones.' },
      { title: 'Semiconductor Talent Initiative', meta: '2024', body: 'Selected as a delivery partner for a state VLSI talent programme.' },
      { title: 'Safety Excellence Recognition', meta: '2023', body: 'Zero reportable lab incidents across 60+ commissioned centres.' },
      { title: 'ISO 9001:2015 Certified', meta: 'Since 2019', body: 'Quality management certification covering lab delivery and training.' },
    ],
    media: [
      { label: 'Expo Main Stage', sub: 'National Tech Expo' },
      { label: 'Embedded Lab', sub: 'Bring-up session' },
      { label: 'VLSI Workstations', sub: 'Verification lab' },
      { label: 'Conveyor Rig', sub: 'Automation CoE' },
      { label: 'Drone Cage', sub: 'Flight testing' },
      { label: 'Faculty Cohort', sub: 'Development series' },
      { label: 'Design Review', sub: 'Capstone gate' },
      { label: 'Award Ceremony', sub: 'Industry Council' },
      { label: 'Industry Visit', sub: 'Plant floor' },
      { label: 'Championship Finals', sub: 'Robotics arena' },
    ],
    testimonials: [
      { text: 'The lab was commissioned with documentation we could actually maintain. Two years on, our own faculty run the embedded track without us calling for help.', author: 'Prof. Ramesh Chandra', role: 'Head of ECE, Deccan Institute of Engineering' },
      { text: 'I built a board that boots and defended it in front of a practising engineer. That interview answered itself.', author: 'Sai Teja', role: 'Alumnus, 2023 batch' },
      { text: 'Candidates from Technical Hub centres arrive knowing what a bench looks like. Our onboarding time has dropped noticeably.', author: 'Anita Deshpande', role: 'Engineering Manager, Orbtek Semiconductors' },
    ],
    contact: {
      lead: 'Speak with our institutional partnerships team about a lab, a faculty cohort or a full MOU. Campus visits can be arranged within a fortnight.',
      offices: [
        { title: 'Head Office', subtitle: 'Hyderabad', body: 'Plot 42, HITEC City Road, Madhapur, Hyderabad 500081' },
        { title: 'Vijayawada Office', subtitle: 'Regional', body: '2nd Floor, Benz Circle Commercial Complex, Vijayawada 520010' },
        { title: 'Pune Desk', subtitle: 'Industry projects', body: 'Office 8, Hinjawadi Phase 2, Pune 411057' },
      ],
      lines: [
        'Partnerships: mou@technicalhub.example',
        'Laboratories: labs@technicalhub.example',
        'Phone: +91 90000 67890',
        'Office hours: Monday to Saturday, 9:00am to 6:00pm IST',
      ],
    },
  },
};

/** Tab list, pre-created for both organizations in this order. */
export const SECTION_ORDER = [
  { key: 'profile', title: 'Profile / About', icon: '◆' },
  { key: 'ceo-message', title: 'CEO / Leadership Message', icon: '❝' },
  { key: 'vision-mission', title: 'Vision, Mission & Values', icon: '★' },
  { key: 'best-practices', title: 'Best Practices', icon: '✦' },
  { key: 'programs', title: 'Programs / Courses', icon: '▤' },
  { key: 'team', title: 'Team / Trainers', icon: '⬢' },
  { key: 'initiatives', title: 'Initiatives', icon: '◈' },
  { key: 'certifications', title: 'Certifications', icon: '✚' },
  { key: 'placements', title: 'Placements', icon: '▲' },
  { key: 'coe', title: 'Centers of Excellence', icon: '◉' },
  { key: 'mous', title: 'MOUs / Academic Partnerships', icon: '⬟' },
  { key: 'moments', title: 'Memorable Moments', icon: '❖' },
  { key: 'achievements', title: 'Achievements & Awards', icon: '✧' },
  { key: 'media', title: 'Media / Gallery', icon: '▣' },
  { key: 'testimonials', title: 'Testimonials', icon: '❞' },
  { key: 'contact', title: 'Contact', icon: '✉' },
];
