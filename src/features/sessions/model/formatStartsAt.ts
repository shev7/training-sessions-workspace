const startsAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatStartsAt = (iso: string): string =>
  startsAtFormatter.format(new Date(iso));
