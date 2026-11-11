import { ObjectId } from "mongodb";

export const fail = (status, message) =>
  Object.assign(new Error(message), { status });

export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const publicUser = ({ _id, name, email, photo = "" }) => ({
  id: _id.toString(),
  name,
  email,
  photo,
});

export const idFrom = (value) => {
  if (!ObjectId.isValid(value)) throw fail(400, "Invalid resource id.");
  return new ObjectId(value);
};
