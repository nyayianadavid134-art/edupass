const roleDashboards = {
  super_admin: {
    title: 'Platform command center',
    eyebrow: 'EDUPASS PLATFORM',
    description: 'Monitor schools, subscriptions, platform activity, and service health without exposing school data by default.',
    navigation: [
      ['Dashboard', '/admin/dashboard', 'platform.dashboard'], ['Schools', '/workspace/schools', 'platform.schools'], ['Subscriptions', '/workspace/subscriptions', 'platform.subscriptions'], ['Payments', '/workspace/platform-payments', 'platform.payments'], ['Plans & Pricing', '/workspace/plans', 'platform.subscriptions'], ['Platform Users', '/workspace/platform-users', 'platform.users'], ['Analytics', '/workspace/platform-analytics', 'platform.analytics'], ['Support', '/workspace/support', 'platform.support'], ['System Settings', '/workspace/platform-settings', 'platform.settings'], ['Audit Logs', '/workspace/audit-logs', 'audit.view'],
    ],
    widgets: [['Total schools', 'schools', 'Across EduPass'], ['Active schools', 'activeSchools', 'Currently operating'], ['Paid schools', 'paidSchools', 'Subscription accounts'], ['Monthly recurring revenue', 'mrr', 'Platform revenue']],
    actions: [['Review schools', '/workspace/schools', 'platform.schools'], ['View subscriptions', '/workspace/subscriptions', 'platform.subscriptions'], ['Check system health', '/health', 'platform.dashboard']],
  },
  school_admin: {
    title: 'School operations dashboard', eyebrow: 'SCHOOL ADMINISTRATION', description: 'Run the complete school from one connected workspace.',
    navigation: [['Dashboard', '/school/dashboard', 'dashboard.school'], ['Students', '/workspace/students', 'students.view'], ['Teachers & Staff', '/workspace/staff', 'staff.view'], ['Invite people', '/workspace/invitations', 'users.invite'], ['Classes', '/workspace/classes', 'classes.manage'], ['Subjects', '/workspace/subjects', 'academics.view'], ['Academics', '/workspace/academics', 'academics.view'], ['Attendance', '/workspace/attendance', 'attendance.view'], ['Digital IDs', '/workspace/digital-ids', 'digital_ids.view'], ['Fees & Finance', '/workspace/finance', 'finance.view'], ['Communication', '/workspace/communication', 'communication.send'], ['Reports', '/workspace/reports', 'reports.view'], ['School Settings', '/workspace/school-settings', 'school.settings'], ['Subscription & Billing', '/workspace/billing', 'subscription.view'], ['Audit Logs', '/workspace/audit-logs', 'audit.view']],
    widgets: [['Total students', 'students', 'Enrolled this year'], ['Total teachers & staff', 'staff', 'Active team members'], ['Present today', 'presentToday', 'School attendance'], ['Outstanding fees', 'outstandingFees', 'Needs follow-up']],
    actions: [['Add student', '/workspace/students', 'students.create'], ['Invite staff, parents or students', '/workspace/invitations', 'users.invite'], ['Generate digital ID', '/workspace/digital-ids', 'digital_ids.create'], ['Take attendance', '/workspace/attendance', 'attendance.create'], ['Create invoice', '/workspace/finance', 'finance.create'], ['Send announcement', '/workspace/communication', 'communication.send'], ['View reports', '/workspace/reports', 'reports.view']],
  },
  head_teacher: {
    title: 'School performance', eyebrow: 'HEAD TEACHER', description: 'See the patterns that help your school improve, without opening financial administration.',
    navigation: [['Dashboard', '/head-teacher/dashboard', 'dashboard.head_teacher'], ['Students', '/workspace/students', 'students.view'], ['Classes', '/workspace/classes', 'classes.view'], ['Teachers', '/workspace/staff', 'staff.view'], ['Attendance', '/workspace/attendance', 'attendance.view'], ['Academics', '/workspace/academics', 'academics.view'], ['Reports', '/workspace/reports', 'reports.view'], ['Announcements', '/workspace/communication', 'communication.send'], ['Events', '/workspace/events', 'events.view'], ['Certificates', '/workspace/certificates', 'certificates.view']],
    widgets: [['Students present', 'presentToday', 'Today across school'], ['Attendance rate', 'attendanceRate', 'This term'], ['Classes', 'classes', 'Active classes'], ['Academic trend', 'academicTrend', 'Performance direction']],
    actions: [['View attendance', '/workspace/attendance', 'attendance.view'], ['Review results', '/workspace/academics', 'academics.view'], ['Class performance', '/workspace/reports', 'reports.view'], ['Send announcement', '/workspace/communication', 'communication.send']],
  },
  class_teacher: {
    title: 'My teaching workspace', eyebrow: 'CLASS TEACHER', description: 'Manage only the classes and students assigned to you.',
    navigation: [['Dashboard', '/teacher/dashboard', 'dashboard.teacher'], ['My Classes', '/workspace/my-classes', 'classes.assigned'], ['Students', '/workspace/my-students', 'students.assigned.view'], ['Attendance', '/workspace/my-attendance', 'attendance.assigned.view'], ['Assignments', '/workspace/assignments', 'assignments.manage'], ['Assessments', '/workspace/assessments', 'assessments.manage'], ['Grades', '/workspace/grades', 'grades.manage'], ['Timetable', '/workspace/timetable', 'timetable.assigned.view'], ['Announcements', '/workspace/communication', 'communication.class.send'], ['Profile', '/workspace/profile', 'profile.view']],
    widgets: [['My classes', 'assignedClasses', 'Classes assigned to you'], ['My students', 'assignedStudents', 'Students in your classes'], ['Today attendance', 'presentToday', 'Your class register'], ['Pending work', 'pendingAssignments', 'Assignments to review']],
    actions: [['Take attendance', '/workspace/my-attendance', 'attendance.assigned.create'], ['Add assignment', '/workspace/assignments', 'assignments.manage'], ['Enter marks', '/workspace/grades', 'grades.manage'], ['View students', '/workspace/my-students', 'students.assigned.view']],
  },
  teacher: null,
  finance: {
    title: 'Finance dashboard', eyebrow: 'FINANCE OFFICE', description: 'Track fees, invoices, payments, balances, and receipts without academic administration access.',
    navigation: [['Dashboard', '/finance/dashboard', 'dashboard.finance'], ['Fee Structures', '/workspace/fee-structures', 'finance.view'], ['Student Fees', '/workspace/student-fees', 'finance.view'], ['Invoices', '/workspace/invoices', 'finance.view'], ['Payments', '/workspace/payments', 'finance.payments.create'], ['Receipts', '/workspace/receipts', 'finance.receipts.create'], ['Outstanding Balances', '/workspace/outstanding-balances', 'finance.view'], ['Financial Reports', '/workspace/finance-reports', 'finance.reports.view']],
    widgets: [['Fees expected', 'feesExpected', 'Current term'], ['Fees collected', 'feesCollected', 'Payments received'], ['Outstanding balances', 'outstandingFees', 'Requires follow-up'], ["Today's payments", 'todayPayments', 'Posted today']],
    actions: [['Create invoice', '/workspace/finance', 'finance.create'], ['Record payment', '/workspace/payments', 'finance.payments.create'], ['Outstanding fees', '/workspace/outstanding-balances', 'finance.view'], ['Generate receipt', '/workspace/receipts', 'finance.receipts.create'], ['Financial report', '/workspace/finance-reports', 'finance.reports.view']],
  },
  librarian: {
    title: 'Library desk', eyebrow: 'LIBRARY MANAGEMENT', description: 'Keep books moving and identify borrowers through their EduPass identity.',
    navigation: [['Dashboard', '/library/dashboard', 'dashboard.library'], ['Books', '/workspace/books', 'library.books.manage'], ['Categories', '/workspace/book-categories', 'library.books.manage'], ['Borrowing', '/workspace/borrowing', 'library.borrowing.manage'], ['Returns', '/workspace/returns', 'library.borrowing.manage'], ['Overdue', '/workspace/overdue-books', 'library.reports.view'], ['Students', '/workspace/student-lookup', 'students.lookup'], ['Reports', '/workspace/library-reports', 'library.reports.view']],
    widgets: [['Total books', 'totalBooks', 'Catalogued books'], ['Available books', 'availableBooks', 'Ready to borrow'], ['Borrowed books', 'borrowedBooks', 'Currently out'], ['Overdue books', 'overdueBooks', 'Needs return']],
    actions: [['Add book', '/workspace/books', 'library.books.manage'], ['Issue book', '/workspace/borrowing', 'library.borrowing.manage'], ['Return book', '/workspace/returns', 'library.borrowing.manage'], ['Search student', '/workspace/student-lookup', 'students.lookup']],
  },
  transport_manager: {
    title: 'Transport operations', eyebrow: 'TRANSPORT MANAGER', description: 'Coordinate routes, vehicles, drivers, student assignments, and trips.',
    navigation: [['Dashboard', '/transport/dashboard', 'dashboard.transport'], ['Vehicles', '/workspace/vehicles', 'transport.manage'], ['Drivers', '/workspace/drivers', 'transport.manage'], ['Routes', '/workspace/routes', 'transport.manage'], ['Students', '/workspace/student-lookup', 'students.lookup'], ['Assignments', '/workspace/transport-assignments', 'transport.manage'], ['Trips', '/workspace/trips', 'transport.manage'], ['Attendance', '/workspace/transport-attendance', 'transport.manage'], ['Reports', '/workspace/transport-reports', 'transport.reports.view']],
    widgets: [['Active vehicles', 'activeVehicles', 'On the road'], ['Drivers', 'drivers', 'Assigned drivers'], ['Routes', 'routes', 'Configured routes'], ['Students assigned', 'transportStudents', 'Riding today']],
    actions: [['Add vehicle', '/workspace/vehicles', 'transport.manage'], ['Add driver', '/workspace/drivers', 'transport.manage'], ['Create route', '/workspace/routes', 'transport.manage'], ['Assign students', '/workspace/transport-assignments', 'transport.manage']],
  },
  receptionist: {
    title: 'Front desk', eyebrow: 'SCHOOL ACCESS', description: 'Verify identities, manage visitors, and keep entry and exit records accurate.',
    navigation: [['Dashboard', '/reception/dashboard', 'dashboard.reception'], ['ID Verification', '/workspace/id-verification', 'digital_ids.verify'], ['Visitors', '/workspace/visitors', 'visitors.manage'], ['Student Search', '/workspace/student-lookup', 'students.lookup'], ['Entry & Exit', '/workspace/entry-exit', 'entry_exit.manage'], ['Visitor Passes', '/workspace/visitor-passes', 'visitors.manage'], ['Emergency Contacts', '/workspace/emergency-contacts', 'students.lookup']],
    widgets: [['Students present', 'presentToday', 'Checked in today'], ['Visitors today', 'visitorsToday', 'Logged visitors'], ['Expected visitors', 'expectedVisitors', 'Scheduled visits'], ['Suspended IDs', 'suspendedIds', 'Require attention']],
    actions: [['Scan EduPass ID', '/workspace/id-verification', 'digital_ids.verify'], ['Register visitor', '/workspace/visitors', 'visitors.manage'], ['Issue visitor pass', '/workspace/visitor-passes', 'visitors.manage'], ['Record exit', '/workspace/entry-exit', 'entry_exit.manage']],
  },
  student: {
    title: 'My school day', eyebrow: 'STUDENT PORTAL', description: 'Your timetable, attendance, assignments, grades, and digital identity in one place.',
    navigation: [['Dashboard', '/student/dashboard', 'dashboard.student'], ['My Digital ID', '/workspace/my-digital-id', 'digital_ids.own.view'], ['Timetable', '/workspace/my-timetable', 'timetable.own.view'], ['Attendance', '/workspace/my-attendance', 'attendance.own.view'], ['Assignments', '/workspace/my-assignments', 'assignments.own.view'], ['Grades', '/workspace/my-grades', 'grades.own.view'], ['Library', '/workspace/my-library', 'library.own.view'], ['Events', '/workspace/events', 'events.view'], ['Profile', '/workspace/profile', 'profile.view']],
    widgets: [['Attendance', 'attendanceRate', 'Your current percentage'], ['Assignments', 'pendingAssignments', 'Due soon'], ['Recent grades', 'recentGrades', 'Latest results'], ['Library loans', 'libraryLoans', 'Books with you']],
    actions: [['Show digital ID', '/workspace/my-digital-id', 'digital_ids.own.view'], ['View timetable', '/workspace/my-timetable', 'timetable.own.view'], ['View assignments', '/workspace/my-assignments', 'assignments.own.view'], ['View grades', '/workspace/my-grades', 'grades.own.view']],
  },
  parent: {
    title: 'Family dashboard', eyebrow: 'PARENT PORTAL', description: 'Stay connected to the children explicitly linked to your account.',
    navigation: [['Dashboard', '/parent/dashboard', 'dashboard.parent'], ['My Children', '/workspace/my-children', 'children.own.view'], ['Attendance', '/workspace/my-children-attendance', 'attendance.own.view'], ['Academics', '/workspace/my-children-academics', 'academics.own.view'], ['Assignments', '/workspace/my-children-assignments', 'academics.own.view'], ['Fees & Payments', '/workspace/my-fees', 'fees.own.view'], ['Timetable', '/workspace/my-children-timetable', 'academics.own.view'], ['Announcements', '/workspace/announcements', 'messages.own.manage'], ['Messages', '/workspace/messages', 'messages.own.manage'], ['Events', '/workspace/events', 'events.view'], ['Profile', '/workspace/profile', 'profile.view']],
    widgets: [['Children', 'children', 'Linked to your account'], ['Attendance today', 'presentToday', 'Across your children'], ['Outstanding fees', 'outstandingFees', 'Needs attention'], ['Assignments', 'pendingAssignments', 'Across your children']],
    actions: [['View child', '/workspace/my-children', 'children.own.view'], ['View attendance', '/workspace/my-children-attendance', 'attendance.own.view'], ['Pay fees', '/workspace/my-fees', 'fees.own.view'], ['Contact school', '/workspace/messages', 'messages.own.manage']],
  },
  staff: {
    title: 'My workday', eyebrow: 'STAFF WORKSPACE', description: 'See only the operational tasks and communication assigned to your account.',
    navigation: [['Dashboard', '/staff/dashboard', 'dashboard.staff'], ['My Tasks', '/workspace/my-tasks', 'dashboard.staff'], ['Attendance', '/workspace/attendance', 'attendance.view'], ['Announcements', '/workspace/announcements', 'communication.view'], ['Profile', '/workspace/profile', 'profile.view']],
    widgets: [['My tasks', 'tasks', 'Assigned work'], ['Attendance today', 'presentToday', 'Current status'], ['Announcements', 'announcements', 'Unread updates'], ['Profile status', 'profileStatus', 'Account readiness']],
    actions: [['View tasks', '/workspace/my-tasks', 'dashboard.staff'], ['View attendance', '/workspace/attendance', 'attendance.view'], ['Open announcements', '/workspace/announcements', 'communication.view']],
  },
};

roleDashboards.teacher = roleDashboards.class_teacher;

module.exports = { roleDashboards };
