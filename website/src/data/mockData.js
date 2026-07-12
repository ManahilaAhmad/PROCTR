export const allSections = ["CS-301 A", "CS-301 B", "CS-402 A", "CS-415 A", "CS-501 A"];

export const timetableData = [
    { exam: "Data Structures Lab", course: "CS-301", section: "CS-301 A", date: "Jul 2, 2026", time: "09:00 AM", lab: "Lab-3", invigilator: "Dr. Sana Mir", students: 34, status: "Confirmed" },
    { exam: "Data Structures Lab", course: "CS-301", section: "CS-301 B", date: "Jul 2, 2026", time: "11:00 AM", lab: "Lab-1", invigilator: "Prof. Arif", students: 30, status: "Confirmed" },
    { exam: "OS Lab Final", course: "CS-402", section: "CS-402 A", date: "Jul 8, 2026", time: "11:00 AM", lab: "Lab-1", invigilator: "Prof. Malik", students: 28, status: "Confirmed" },
    { exam: "Networks Lab", course: "CS-415", section: "CS-415 A", date: "Jul 15, 2026", time: "02:00 PM", lab: "Lab-2", invigilator: "Unassigned", students: 30, status: "Pending" },
    { exam: "AI Practical", course: "CS-501", section: "CS-501 A", date: "Jul 20, 2026", time: "09:00 AM", lab: "TBD", invigilator: "Unassigned", students: 22, status: "Draft" },
];

export const labsData = [
    { name: "Lab-1", pcs: 42, capacity: 40, network: "192.168.1.0/24", status: "Available", exam: "—" },
    { name: "Lab-2", pcs: 36, capacity: 35, network: "192.168.2.0/24", status: "Available", exam: "—" },
    { name: "Lab-3", pcs: 40, capacity: 38, network: "192.168.3.0/24", status: "In Use", exam: "CS-301 A" },
    { name: "Lab-4", pcs: 32, capacity: 30, network: "192.168.4.0/24", status: "Available", exam: "—" },
    { name: "Lab-5", pcs: 44, capacity: 42, network: "192.168.5.0/24", status: "Maintenance", exam: "—" },
];

export const sectionResultsData = [
    { section: "CS-301 A", exam: "Data Structures Lab", students: 34, appeared: 32, avg: 78, highest: 97, lowest: 41, passRate: 88, gradeA: 9, gradeB: 14, gradeC: 7, gradeF: 2 },
    { section: "CS-301 B", exam: "Data Structures Lab", students: 30, appeared: 29, avg: 82, highest: 100, lowest: 55, passRate: 97, gradeA: 13, gradeB: 12, gradeC: 3, gradeF: 1 },
    { section: "CS-402 A", exam: "OS Lab Final", students: 28, appeared: 27, avg: 74, highest: 95, lowest: 38, passRate: 85, gradeA: 7, gradeB: 11, gradeC: 6, gradeF: 3 },
    { section: "CS-415 A", exam: "Networks Lab", students: 30, appeared: 28, avg: 69, highest: 91, lowest: 32, passRate: 79, gradeA: 5, gradeB: 10, gradeC: 7, gradeF: 6 },
    { section: "CS-501 A", exam: "AI Practical", students: 22, appeared: 22, avg: 85, highest: 99, lowest: 61, passRate: 100, gradeA: 12, gradeB: 8, gradeC: 2, gradeF: 0 },
];