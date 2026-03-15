"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDatabase, ref, onValue, remove, update } from "firebase/database";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { rtdb } from "@/lib/firebase/firebase";
type ScheduleItem = {
  id: string;
  subject: string;
  day: string;
  time: string; // "HH:MM–HH:MM"
  createdAt: string;
};

export function CourseTable() {
  const db = getDatabase();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [editingCourse, setEditingCourse] = useState<ScheduleItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editDays, setEditDays] = useState("MWF");
  const [editCustomDays, setEditCustomDays] = useState<string[]>([]);
  const [editUseCustom, setEditUseCustom] = useState(false);

  // Convert 24-hour time to 12-hour format with AM/PM
  const formatTimeTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  // Format "HH:MM–HH:MM" -> "H:MM AM - H:MM PM"
  const formatTimeRange = (timeRange: string): string => {
    const [startTime, endTime] = timeRange.split("–");
    return `${formatTimeTo12Hour(startTime)} - ${formatTimeTo12Hour(endTime)}`;
  };

  const to24Hour = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const handleEditClick = (course: ScheduleItem) => {
    setEditingCourse(course);
    setEditName(course.subject);

    const defaultDays = ["MWF", "TuTh", "MW"];
    if (defaultDays.includes(course.day)) {
      setEditDays(course.day);
      setEditUseCustom(false);
      setEditCustomDays([]);
    } else {
      const customDayArray: string[] = [];
      let remaining = course.day;

      const dayPatterns = [
        { pattern: "Su", day: "Su" },
        { pattern: "Sa", day: "Sa" },
        { pattern: "Th", day: "Th" },
        { pattern: "Tu", day: "Tu" },
        { pattern: "M", day: "M" },
        { pattern: "W", day: "W" },
        { pattern: "F", day: "F" },
      ];

      for (const { pattern, day } of dayPatterns) {
        if (remaining.includes(pattern)) {
          customDayArray.push(day);
          remaining = remaining.replace(pattern, "");
        }
      }

      setEditCustomDays(customDayArray);
      setEditUseCustom(true);
      setEditDays("MWF");
    }

    const [startTime, endTime] = course.time.split("–");
    setEditStart(startTime);
    setEditEnd(endTime);

    setIsEditDialogOpen(true);
  };

  const handleEditCustomDayToggle = (day: string) => {
    setEditCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCourse) return;

    const scheduleRef = ref(db, `users/${user.uid}/schedule/${editingCourse.id}`);

    await update(scheduleRef, {
      subject: editName,
      day: editUseCustom ? editCustomDays.join("") : editDays,
      time: `${to24Hour(editStart)}–${to24Hour(editEnd)}`,
    });

    setIsEditDialogOpen(false);
    setEditingCourse(null);

    // Reset form
    setEditName("");
    setEditStart("");
    setEditEnd("");
    setEditDays("MWF");
    setEditCustomDays([]);
    setEditUseCustom(false);
  };

  const handleDelete = async (courseId: string) => {
    if (!user) return;

    if (window.confirm("Are you sure you want to delete this course?")) {
      const scheduleRef = ref(db, `users/${user.uid}/schedule/${courseId}`);
      await remove(scheduleRef);
    }
  };

  useEffect(() => {
    // Wait for auth to finish restoring
    if (authLoading) return;

    // Not logged in
    if (!user) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const scheduleRef = ref(db, `users/${user.uid}/schedule`);

    const unsubscribe = onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list: ScheduleItem[] = Object.entries(data).map(([id, value]) => ({
        id,
        ...(value as Omit<ScheduleItem, "id">),
      }));
      setSchedules(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, db]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading schedule...</div>;
  }

  return (
    <>
      <Table>
        <TableCaption>Your class schedule.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Day</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {schedules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No classes yet.
              </TableCell>
            </TableRow>
          ) : (
            schedules.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="font-medium">{course.subject}</TableCell>
                <TableCell>{formatTimeRange(course.time)}</TableCell>
                <TableCell>{course.day}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(course)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleDelete(course.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Number of courses:</TableCell>
            <TableCell>{schedules.length}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>Update the course details below.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-3">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Biology"
                  required
                />
              </div>

              <div className="grid gap-3">
                <Label>Days</Label>

                {!editUseCustom ? (
                  <>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      onValueChange={(val) => setEditDays(val || "MWF")}
                      value={editDays}
                    >
                      <ToggleGroupItem value="MWF">MWF</ToggleGroupItem>
                      <ToggleGroupItem value="TuTh">TuTh</ToggleGroupItem>
                      <ToggleGroupItem value="MW">MW</ToggleGroupItem>
                    </ToggleGroup>

                    <button
                      type="button"
                      onClick={() => setEditUseCustom(true)}
                      className="text-sm text-blue-600 underline text-left w-fit"
                    >
                      Use custom days
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {["M", "Tu", "W", "Th", "F", "Sa", "Su"].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleEditCustomDayToggle(day)}
                          className={`px-3 py-2 text-sm rounded border ${
                            editCustomDays.includes(day)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:bg-accent"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditUseCustom(false);
                        setEditCustomDays([]);
                      }}
                      className="text-sm text-blue-600 underline text-left w-fit"
                    >
                      Use default days
                    </button>
                  </>
                )}

                <div className="flex gap-3 mt-3">
                  <div>
                    <Label>Starts</Label>
                    <Input
                      type="time"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>Ends</Label>
                    <Input
                      type="time"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}