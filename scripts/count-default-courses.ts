import { getAllDefaultCourses } from '../lib/defaultCurriculum';

const branches = ['CSE', 'EE', 'ME', 'BE', 'CE', 'EP', 'DSE', 'BSCS', 'BSEP', 'BSME'];
const allCourses = new Set();

branches.forEach(branch => {
  const courses = getAllDefaultCourses(branch, 8);
  courses.forEach(c => allCourses.add(c.code));
});

console.log('Total unique courses across all branches:', allCourses.size);
console.log('\nCSE sample:');
const cseCourses = getAllDefaultCourses('CSE', 8);
cseCourses.slice(0, 10).forEach(c => console.log(`  ${c.code} - ${c.name}`));
