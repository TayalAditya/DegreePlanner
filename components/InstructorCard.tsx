'use client';

import React from 'react';
import { Users, Mail, Phone, MapPin, Award } from 'lucide-react';
import { useCourseInstructors, type Instructor } from '@/lib/hooks/useCourseInstructors';

interface InstructorCardProps {
  courseCode: string;
  className?: string;
}

export function InstructorCard({ courseCode, className = '' }: InstructorCardProps) {
  const { data, isLoading, error } = useCourseInstructors(courseCode);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">Loading instructors...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">
          Instructors ({data.instructors.length})
        </h3>
      </div>

      <div className="space-y-3">
        {data.instructors.map((instructor) => (
          <InstructorItem key={instructor.id} instructor={instructor} />
        ))}
      </div>
    </div>
  );
}

interface InstructorItemProps {
  instructor: Instructor;
}

function InstructorItem({ instructor }: InstructorItemProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {instructor.name}
            </p>
            {instructor.isPrimary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                Primary
              </span>
            )}
          </div>

          {instructor.designation && (
            <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
              <Award className="w-3 h-3" />
              {instructor.designation}
            </p>
          )}

          {instructor.responsibilities && (
            <p className="text-xs text-gray-600 mt-1">
              {instructor.responsibilities}
            </p>
          )}
        </div>
      </div>

      {(instructor.email || instructor.phone || instructor.office) && (
        <div className="mt-2 space-y-1 text-xs text-gray-600">
          {instructor.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <a href={`mailto:${instructor.email}`} className="truncate hover:text-blue-600">
                {instructor.email}
              </a>
            </div>
          )}
          {instructor.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 flex-shrink-0" />
              <a href={`tel:${instructor.phone}`} className="hover:text-blue-600">
                {instructor.phone}
              </a>
            </div>
          )}
          {instructor.office && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span>{instructor.office}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface InstructorListProps {
  courseCode: string;
  variant?: 'compact' | 'full';
}

export function InstructorList({ courseCode, variant = 'compact' }: InstructorListProps) {
  const { data, isLoading } = useCourseInstructors(courseCode);

  if (isLoading) return <span className="text-xs text-gray-400">Loading...</span>;

  if (!data || data.instructors.length === 0) {
    return <span className="text-xs text-gray-500">No instructors found</span>;
  }

  if (variant === 'compact') {
    return (
      <div className="text-xs text-gray-700">
        {data.instructors
          .filter((i) => i.isPrimary || data.instructors.length === 1)
          .map((i) => i.name)
          .join(', ')}
        {data.instructors.filter((i) => !i.isPrimary).length > 0 && (
          <span className="text-gray-500">
            {' '}
            (+{data.instructors.filter((i) => !i.isPrimary).length} more)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.instructors.map((instructor) => (
        <div key={instructor.id} className="text-sm">
          <p className="font-medium text-gray-900">{instructor.name}</p>
          {instructor.email && (
            <p className="text-xs text-gray-600">{instructor.email}</p>
          )}
        </div>
      ))}
    </div>
  );
}
