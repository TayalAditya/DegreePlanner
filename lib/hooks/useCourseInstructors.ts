import { useQuery } from '@tanstack/react-query';

export interface Instructor {
  id: string;
  name: string;
  email?: string;
  department?: string;
  designation?: string;
  phone?: string;
  office?: string;
  isPrimary: boolean;
  responsibilities?: string;
  semester?: number;
  year?: number;
  term?: string;
}

export interface CourseInstructorsResponse {
  courseCode: string;
  courseName: string;
  instructors: Instructor[];
  totalInstructors: number;
}

export function useCourseInstructors(courseCode: string | null) {
  return useQuery<CourseInstructorsResponse | null>({
    queryKey: ['courseInstructors', courseCode],
    queryFn: async () => {
      if (!courseCode) return null;

      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseCode.toUpperCase())}/instructors`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch instructors');
      }

      return response.json();
    },
    enabled: !!courseCode,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

export function useAllCourseInstructors(courseCodes: string[]) {
  return useQuery<Map<string, CourseInstructorsResponse>>({
    queryKey: ['courseInstructors', courseCodes],
    queryFn: async () => {
      const results = new Map<string, CourseInstructorsResponse>();

      const promises = courseCodes.map((code) =>
        fetch(
          `/api/courses/${encodeURIComponent(code.toUpperCase())}/instructors`
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        if (response) {
          results.set(courseCodes[index], response);
        }
      });

      return results;
    },
    enabled: courseCodes.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
