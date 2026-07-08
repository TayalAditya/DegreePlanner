const XLSX = require('xlsx');

const data = [
  // B25 Sem 3
  ['B25','CSE',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','CSE',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','CSE',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','CSE',3,'DC','CS-208',4,'Mathematical Foundations of Computer Science'],
  ['B25','CSE',3,'DC','CS-212',4,'Design of Algorithms'],
  ['B25','CSE',3,'DC','CS-213',1,'Reverse Engineering'],
  ['B25','CSE',3,'DC','CS-214',4,'Computer Organization'],

  ['B25','EE',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','EE',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','EE',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','EE',3,'DC','EE-203',3,'Network Theory'],
  ['B25','EE',3,'DC','EE-210',3,'Digital System Design'],
  ['B25','EE',3,'DC','EE-210P',1,'Digital Systems Design Practicum'],
  ['B25','EE',3,'DC','EE-260',3,'Signals and Systems'],
  ['B25','EE',3,'DC','EE-261',3,'Electrical Systems Around Us'],
  ['B25','EE',3,'DC','EE-261P',2,'Electrical Systems Around Us Lab'],
  ['B25','EE',3,'DC','EE-311',3,'Device Electronics For Integrated Circuits'],

  ['B25','ME',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','ME',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','ME',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','ME',3,'DC','EE-261',3,'Electrical Systems Around Us'],
  ['B25','ME',3,'DC','IC-241',3,'Material Science for Engineers'],
  ['B25','ME',3,'DC','ME-206',3,'Mechanics of Solids'],
  ['B25','ME',3,'DC','ME-210',3,'Fluid Mechanics'],
  ['B25','ME',3,'DC','ME-212',3,'Product Manufacturing Technology'],
  ['B25','ME',3,'DC','ME-213',4,'Engineering Thermodynamics'],

  ['B25','CE',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','CE',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','CE',3,'DC','CE-203',3,'Civil Engineering Materials'],
  ['B25','CE',3,'DC','CE-203P',1,'Building Materials Lab'],
  ['B25','CE',3,'DC','CE-252',3,'Geology and Geomorphology'],
  ['B25','CE',3,'DC','CE-310',3,'Strength of Materials and Structures'],
  ['B25','CE',3,'DC','CE-310P',1,'Strength of Materials and Structures Lab'],

  ['B25','EP',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','EP',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','EP',3,'DC','EP-301',4,'Engineering Mathematics - 2'],
  ['B25','EP',3,'DC','EP-321',3,'Foundations of Electrodynamics'],
  ['B25','EP',3,'DC','PH-301',3,'Quantum Mechanics and Applications'],

  ['B25','BE',3,'IC','IC-136',3,'Understanding Biotechnology and Its Applications'],
  ['B25','BE',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','BE',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','BE',3,'DC','BE-201',4,'Cell Biology'],
  ['B25','BE',3,'DC','BE-202',4,'Biochemistry and Molecular Biology'],
  ['B25','BE',3,'DC','BE-308',4,'Introduction to Biomanufacturing'],
  ['B25','BE',3,'DC','BE-309',4,'Biosensing & Bioinstrumentation'],

  ['B25','MNC',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','MNC',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','MNC',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','MNC',3,'DC','CS-208',4,'Mathematical Foundations of Computer Science'],
  ['B25','MNC',3,'DC','MA-210',3,'Real and Complex Analysis'],
  ['B25','MNC',3,'DC','MA-211',4,'Ordinary Differential Equations'],
  ['B25','MNC',3,'DC','MA-312',4,'Design and Analysis of Algorithms'],

  ['B25','MSE',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','MSE',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','MSE',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','MSE',3,'DC','ME-206',3,'Mechanics of Solids'],
  ['B25','MSE',3,'DC','MT-201',3,'Physics of Solids'],
  ['B25','MSE',3,'DC','MT-202',3,'Quantum Mechanics and Applications'],
  ['B25','MSE',3,'DC','MT-203',4,'Materials Synthesis and Characterization'],

  ['B25','MEVLSI',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','MEVLSI',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','MEVLSI',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','MEVLSI',3,'DC','EE-203',3,'Network Theory'],
  ['B25','MEVLSI',3,'DC','EE-210',3,'Digital System Design'],
  ['B25','MEVLSI',3,'DC','EE-210P',1,'Digital Systems Design Practicum'],
  ['B25','MEVLSI',3,'DC','EE-260',3,'Signals and Systems'],
  ['B25','MEVLSI',3,'DC','EE-302',3,'Control Systems (EE-302 / EE-301)'],
  ['B25','MEVLSI',3,'DC','EE-302P',1,'Control Systems Lab (EE-302P / EE-301P)'],
  ['B25','MEVLSI',3,'DC','VL-201',3,'Semiconductor Device for ICs (EE-311 / VL-201)'],

  ['B25','BSCS',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','BSCS',3,'DC','CY-201P',2,'Physical Chemistry Laboratory'],
  ['B25','BSCS',3,'DC','CY-301',3,'Principles and Theories of Physical Chemistry'],
  ['B25','BSCS',3,'DC','CY-302',3,'Principles of Organic Chemistry'],
  ['B25','BSCS',3,'DC','CY-303',3,'Fundamentals of Inorganic Chemistry'],
  ['B25','BSCS',3,'DC','IC-136',3,'Understanding Biotechnology and Its Applications'],

  ['B25','DSAI',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','DSAI',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','DSAI',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','DSAI',3,'DC','CS-213',1,'Reverse Engineering'],
  ['B25','DSAI',3,'DC','DS-313',4,'Statistical Foundations for Data Science'],
  ['B25','DSAI',3,'DC','DS-412',4,'Matrix Computations for Data Science'],

  ['B25','GE-ROBO',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','GE-ROBO',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','GE-ROBO',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','GE-ROBO',3,'DC','DS-201',3,'Data Handling and Visualisation'],
  ['B25','GE-ROBO',3,'DC','EE-261',3,'Electrical Systems Around Us'],
  ['B25','GE-ROBO',3,'DC','ME-206',3,'Mechanics of Solids'],

  ['B25','GE-COMM',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','GE-COMM',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','GE-COMM',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','GE-COMM',3,'DC','CS-313',4,'Computer Networks'],
  ['B25','GE-COMM',3,'DC','EE-203',3,'Network Theory'],
  ['B25','GE-COMM',3,'DC','EE-260',3,'Signals and Systems'],
  ['B25','GE-COMM',3,'DC','EE-261',3,'Electrical Systems Around Us'],

  ['B25','GE-MECH',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','GE-MECH',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','GE-MECH',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','GE-MECH',3,'DC','EE-203',3,'Network Theory'],
  ['B25','GE-MECH',3,'DC','EE-260',3,'Signals and Systems'],
  ['B25','GE-MECH',3,'DC','EE-261',3,'Electrical Systems Around Us'],
  ['B25','GE-MECH',3,'DC','ME-206',3,'Mechanics of Solids'],

  ['B25','GE-OPEN',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','GE-OPEN',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','GE-OPEN',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','GE-OPEN',3,'DC','EE-261',3,'Electrical Systems Around Us'],
  ['B25','GE-OPEN',3,'DC','IC-241',3,'Material Science for Engineers'],
  ['B25','GE-OPEN',3,'DC','ME-212',3,'Product Manufacturing Technology'],
  ['B25','GE-OPEN',3,'DC','ME-213',4,'Engineering Thermodynamics'],

  ['B25','GE-FIN',3,'IC','IC-202P',3,'Design Practicum'],
  ['B25','GE-FIN',3,'IC','IC-222P',2,'Physics Practicum/Practicals'],
  ['B25','GE-FIN',3,'IC','IC-272',3,'Machine Learning'],
  ['B25','GE-FIN',3,'DC','DS-201',3,'Data Handling and Visualisation'],
  ['B25','GE-FIN',3,'DC','EE-261',3,'Electrical Systems Around Us'],
  ['B25','GE-FIN',3,'DC','ME-206',3,'Mechanics of Solids'],

  // B24 Sem 5
  ['B24','CSE',5,'DC','CS-305',3,'Artificial Intelligence'],
  ['B24','CSE',5,'DC','CS-312',4,'Operating System'],
  ['B24','CSE',5,'DC','CS-313',4,'Computer Networks'],

  ['B24','EE',5,'DC','EE-231',3,'Measurement and Instrumentation'],
  ['B24','EE',5,'DC','EE-302',3,'Control Systems (EE-302 / EE-301)'],
  ['B24','EE',5,'DC','EE-302P',1,'Control Systems Lab (EE-302P / EE-301P)'],
  ['B24','EE',5,'DC','EE-303',4,'Power Systems'],
  ['B24','EE',5,'DC','EE-314',4,'Digital Signal Processing'],
  ['B24','EE',5,'DC','EE-326',4,'Computer Organization and Processor Architecture Design'],

  ['B24','ME',5,'DC','ME-303P',1,'Heat Transfer Lab'],
  ['B24','ME',5,'DC','ME-305',4,'Design of Machine Elements'],
  ['B24','ME',5,'DC','ME-309',4,'Theory of Machines'],
  ['B24','ME',5,'DC','ME-310',3,'System Dynamics and Control'],
  ['B24','ME',5,'DC','ME-311P',1,'Design Lab 1'],
  ['B24','ME',5,'DC','ME-315',3,'Manufacturing Engineering 2'],

  ['B24','CE',5,'DC','CE-303',3,'Water Resources Engineering'],
  ['B24','CE',5,'DC','CE-351',3,'Design of Reinforced Concrete Structures'],
  ['B24','CE',5,'DC','CE-352',3,'Transportation Engineering'],
  ['B24','CE',5,'DC','CE-352P',1,'Transportation Engineering Laboratory'],
  ['B24','CE',5,'DC','CE-353P',1,'Civil Engineering Drawing'],
  ['B24','CE',5,'DC','CE-402',3,'Geotechnical Engineering II'],

  ['B24','EP',5,'DC','EE-311',3,'Device Electronics For Integrated Circuits'],
  ['B24','EP',5,'DC','EP-302',3,'Computational Methods for Engineering'],
  ['B24','EP',5,'DC','EP-402P',4,'Engineering Physics Practicum'],

  ['B24','BE',5,'DC','BE-303',4,'Applied Biostatistics'],
  ['B24','BE',5,'DC','BE-305',1,'Bioethics and Regulatory Affairs'],
  ['B24','BE',5,'DC','BE-306',4,'Genetic Engineering: Principles and Applications'],
  ['B24','BE',5,'DC','BE-310',4,'Biomaterials'],

  ['B24','MNC',5,'DC','CS-212',4,'Design of Algorithms'],
  ['B24','MNC',5,'DC','MA-310',4,'Matrix Computation & Lab'],
  ['B24','MNC',5,'DC','MA-311',3,'Mathematical Modelling'],
  ['B24','MNC',5,'DC','MA-313',3,'Formal Languages and Automata Theory'],
  ['B24','MNC',5,'DC','MA-322',4,'Applied Graph Theory'],

  ['B24','MSE',5,'DC','ME-212',3,'Product Manufacturing Technology'],
  ['B24','MSE',5,'DC','MT-301',3,'Phase Transformation'],
  ['B24','MSE',5,'DC','MT-302',3,'Transport Phenomena'],
  ['B24','MSE',5,'DC','MT-303',4,'Computational Materials Science'],
  ['B24','MSE',5,'DC','MT-304',4,'Mechanical Behaviour of Materials'],

  ['B24','MEVLSI',5,'DC','VL-401',3,'RTL Design and Verification'],
  ['B24','MEVLSI',5,'DC','VL-402',3,'RF IC Design'],
  ['B24','MEVLSI',5,'DC','VL-403',4,'CMOS Digital IC Design'],
  ['B24','MEVLSI',5,'DC','VL-404',4,'CMOS Analog IC Design'],
  ['B24','MEVLSI',5,'DC','VL-405',4,'Design For Testability'],

  ['B24','BSCS',5,'DC','CY-512',3,'Advanced Quantum Chemistry'],
  ['B24','BSCS',5,'DC','CY-512P',3,'Physical Chemistry Laboratory'],
  ['B24','BSCS',5,'DC','CY-531',3,'Organic Reactions and Mechanisms'],
  ['B24','BSCS',5,'DC','CY-533P',3,'Inorganic Chemistry Laboratory'],

  ['B24','DSE',5,'DC','CS-305',3,'Artificial Intelligence'],
  ['B24','DSE',5,'DC','DS-404',3,'Information Security and Privacy'],
  ['B24','DSE',5,'DC','DS-413',4,'Introduction to Statistical Learning'],

  ['B24','GE-ROBO',5,'DC','AR-520',3,'Design Practicum of Mechatronic Systems'],
  ['B24','GE-ROBO',5,'DC','AR-521',3,'Control of Robotic Systems'],
  ['B24','GE-ROBO',5,'DC','AR-523',3,'Robot Manipulators'],
  ['B24','GE-ROBO',5,'DC','EE-302',3,'Control Systems (EE-302 / EE-301)'],
  ['B24','GE-ROBO',5,'DC','EE-302P',1,'Control Systems Lab (EE-302P / EE-301P)'],
  ['B24','GE-ROBO',5,'DC','ME-305',4,'Design of Machine Elements'],
  ['B24','GE-ROBO',5,'DC','ME-309',4,'Theory of Machines'],

  ['B24','GE-COMM',5,'DC','EE-231',3,'Measurement and Instrumentation'],
  ['B24','GE-COMM',5,'DC','EE-314',4,'Digital Signal Processing'],

  ['B24','GE-MECH',5,'DC','AR-520',3,'Design Practicum of Mechatronic Systems'],
  ['B24','GE-MECH',5,'DC','EE-231',3,'Measurement and Instrumentation'],
  ['B24','GE-MECH',5,'DC','EE-302',3,'Control Systems (EE-302 / EE-301)'],
  ['B24','GE-MECH',5,'DC','EE-302P',1,'Control Systems Lab (EE-302P / EE-301P)'],
  ['B24','GE-MECH',5,'DC','ME-305',4,'Design of Machine Elements'],
  ['B24','GE-MECH',5,'DC','ME-309',4,'Theory of Machines'],

  ['B24','GE-OPEN',5,'DC','DS-201',3,'Data Handling and Visualisation'],
  ['B24','GE-OPEN',5,'DC','EE-231',3,'Measurement and Instrumentation'],
  ['B24','GE-OPEN',5,'DC','ME-305',4,'Design of Machine Elements'],

  ['B24','GE-FIN',5,'DC','EE-302',3,'Control Systems (EE-302 / EE-301)'],
  ['B24','GE-FIN',5,'DC','EE-302P',1,'Control Systems Lab (EE-302P / EE-301P)'],

  // B23 Sem 7
  ['B23','BSCS',7,'DC','CY-514',3,'Chemical and Statistical Thermodynamics'],
  ['B23','BSCS',7,'DC','CY-535',3,'Introduction to Organometallic Chemistry'],
];

const header = ['Batch','Branch','Semester','Category','Course Code','Credits','Course Name'];
const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

// Column widths
ws['!cols'] = [
  { wch: 6 },   // Batch
  { wch: 10 },  // Branch
  { wch: 9 },   // Semester
  { wch: 9 },   // Category
  { wch: 13 },  // Course Code
  { wch: 8 },   // Credits
  { wch: 55 },  // Course Name
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'IC+DC Upcoming Sem');
XLSX.writeFile(wb, 'IC_DC_Upcoming_Semester.xlsx');
console.log('Written: IC_DC_Upcoming_Semester.xlsx');
