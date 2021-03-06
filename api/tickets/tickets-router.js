const express = require("express");
const router = express.Router();
const Tickets = require("./ticket-model.js");

const validStatuses = ["OPEN", "CLOSED", "RESOLVED"];

router.get("/", async (req, res, next) => {
  if (Object.keys(req.query).length) {
    const filter = req.query;

    if (filter.status) {
      filter.status = filter.status.toUpperCase();
      if (!validStatuses.includes(filter.status)) {
        return next({
          code: 400,
          message: "Please provide a valid status",
        });
      }
    }

    if (filter.claimed) {
      filter.claimed = filter.claimed.toUpperCase();
      if (filter.claimed === "TRUE") filter.claimed = true;
      else if (filter.claimed === "FALSE") filter.claimed = false;
    }

    Tickets.findBy(filter)
      .then((tickets) => res.json(tickets))
      .catch((err) => {
        console.error(err);
        next({ code: 500, message: "There was a problem getting the tickets" });
      });
  } else {
    Tickets.find()
      .then((tickets) => res.json(tickets))
      .catch((err) => {
        console.error(err);
        next({ code: 500, message: "There was a problem getting the tickets" });
      });
  }
});

router.post("/", async (req, res, next) => {
  const userID = req.jwt.id;
  const { title, description, what_ive_tried, categories } = req.body;

  if (!(title && description))
    return next({
      code: 400,
      message: "Please provide a title and description",
    });

  try {
    const ticket = await Tickets.add(
      {
        posted_by: userID,
        title,
        description,
        what_ive_tried,
      },
      categories
    );
    res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    next({ code: 500, message: "There was a problem creating the ticket" });
  }
});

router.put("/:id", async (req, res, next) => {
  const userID = req.jwt.id;
  const ticketID = req.params.id;
  const { title, description, what_ive_tried, categories } = req.body;

  if (title === "" || description === "")
    return next({
      code: 400,
      message: "Please provide a title and description",
    });

  try {
    const ticket = { title, description, what_ive_tried };
    const updatedTicket = await Tickets.update(
      ticket,
      categories,
      ticketID,
      userID
    );
    // TODO: handle attempting to update another user's ticket
    res.status(201).json(updatedTicket);
  } catch (err) {
    console.error(err);
    next({ code: 500, message: "There was a problem updating the ticket" });
  }
});

router.patch("/:id/:action", async (req, res, next) => {
  const userID = req.jwt.id;
  const ticketID = req.params.id;
  const action = req.params.action.toUpperCase();
  let change;

  switch (action) {
    case "CLAIM":
      change = { claimed_by: userID };
      break;

    case "RELEASE":
      change = { claimed_by: null };
      break;

    case "OPEN":
      change = { status: "OPEN" };
      break;

    case "CLOSE":
      change = { status: "CLOSED" };
      break;

    case "RESOLVE":
      change = { status: "RESOLVED" };
      break;

    default:
      return next({
        code: 400,
        message: "Please provide a valid action",
      });
  }

  try {
    const ticket = await Tickets.findById(ticketID);

    if (ticket.claimed_by_id && ticket.claimed_by_id !== userID)
      return next({
        code: 403,
        message: "This ticket is already claimed",
      });

    if (!ticket.claimed_by_id && action === "release")
      return next({
        code: 403,
        message: "Nobody has claimed this ticket",
      });

    if (ticket.posted_by_id === userID) {
      if (action === "claim" || action === "release")
        return next({
          code: 403,
          message: "You can't claim or release your own ticket",
        });
    }

    if (ticket.claimed_by_id === userID) {
      if (action === "claim")
        return next({
          code: 403,
          message: "You've already claimed this ticket",
        });
    }

    const [updatedTicket] = await Tickets.assert(change, ticketID);
    res.status(201).json(updatedTicket);
  } catch (err) {
    console.error(err);
    next({
      code: 500,
      message: "There was a problem updating the ticket",
    });
  }
});

router.delete("/:id", async (req, res, next) => {
  const ticketID = req.params.id;
  const userID = req.jwt.id;
  try {
    const count = await Tickets.remove(ticketID, userID);
    if (!count) return next({ code: 404, message: "Ticket not found" });
    res.status(200).json(count);
  } catch (err) {
    console.error(err);
    next({ code: 500, message: "There was a problem deleting the ticket" });
  }
});

router.get("/:id", async (req, res) => {
  const ticketID = req.params.id;

  try {
    const tickets = await Tickets.findById(ticketID);
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ error });
  }
});

router.get("/:id/comments", async (req, res) => {
  const ticketID = req.params.id;

  try {
    const tickets = await Tickets.findByIdWithComments(ticketID);
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ error });
  }
});

module.exports = router;
