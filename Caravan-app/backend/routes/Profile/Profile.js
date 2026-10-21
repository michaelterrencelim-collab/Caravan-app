const express = require("express");
const router = express.Router();
const db = require("../../imports/database");
const { checkAuth } = require("../../imports/token");

router.customPath = "/api";

// GET CURRENT USER PROFILE
router.get("/profile", checkAuth("user"), async (req, res) => {
    try {

        console.log("Profile user:", req.user);

        const userId = req.user.userId;

        if (!userId) {
            return res.status(401).json({
                error: "User ID not found"
            });
        }

        const result = await db.execute({
            sql: `
                SELECT
                    Customer_id,
                    first_name,
                    last_name,
                    Cus_email,
                    Cus_phone,
                    Cus_birthdate
                FROM Customer
                WHERE Customer_id = ?
            `,
            args: [userId]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Customer not found"
            });
        }

        const customer = result.rows[0];

        return res.status(200).json({
            customerId: customer.Customer_id,
            email: customer.Cus_email,
            phone: customer.Cus_phone ?? '',
            firstName: customer.first_name,
            lastName: customer.last_name,
            birthdate: customer.Cus_birthdate
        });

    } catch (error) {

        console.error("Profile API error:", error);

        return res.status(500).json({
            error: "Unable to retrieve profile"
        });
    }
});

// UPDATE CURRENT USER PROFILE
router.put("/profile", checkAuth("user"), async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            email,
            phone,
            firstName,
            lastName,
            birthdate,
            password
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                error: "User ID not found"
            });
        }

        if (!email || !firstName || !lastName) {
            return res.status(400).json({
                error: "Email, first name, and last name are required"
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({
                error: "Invalid email format"
            });
        }

        if (firstName.length > 100 || lastName.length > 100) {
            return res.status(400).json({
                error: "First name or last name is too long"
            });
        }

        const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
        if (normalizedPhone.length > 30) {
            return res.status(400).json({
                error: "Phone number is too long"
            });
        }

        // Make sure another account is not already using the email.
        const existingEmail = await db.execute({
            sql: `
                SELECT Customer_id
                FROM Customer
                WHERE Cus_email = ?
                AND Customer_id != ?
            `,
            args: [email, userId]
        });

        if (existingEmail.rows.length > 0) {
            return res.status(409).json({
                error: "Email is already used by another account"
            });
        }

        /*
         * Only update the password when the user entered a new value.
         * An empty password means "keep the current password".
         */
        if (password && password.trim() !== "") {
            if (password.length > 255) {
                return res.status(400).json({
                    error: "Password is too long"
                });
            }

            await db.execute({
                sql: `
                    UPDATE Customer
                    SET
                        Cus_email = ?,
                        Cus_phone = ?,
                        first_name = ?,
                        last_name = ?,
                        Cus_birthdate = ?,
                        Cus_password = ?
                    WHERE Customer_id = ?
                `,
                args: [
                    email,
                    normalizedPhone || null,
                    firstName,
                    lastName,
                    birthdate || null,
                    password,
                    userId
                ]
            });
        } else {
            await db.execute({
                sql: `
                    UPDATE Customer
                    SET
                        Cus_email = ?,
                        Cus_phone = ?,
                        first_name = ?,
                        last_name = ?,
                        Cus_birthdate = ?
                    WHERE Customer_id = ?
                `,
                args: [
                    email,
                    normalizedPhone || null,
                    firstName,
                    lastName,
                    birthdate || null,
                    userId
                ]
            });
        }

        return res.status(200).json({
            message: "Profile updated successfully",
            profile: {
                email: email,
                phone: normalizedPhone,
                firstName: firstName,
                lastName: lastName,
                birthdate: birthdate || null
            }
        });

    } catch (error) {
        console.error("Profile update error:", error);

        return res.status(500).json({
            error: "Unable to update profile"
        });
    }
});

// GET CURRENT USER ADDRESSES
router.get("/addresses", checkAuth("user"), async (req, res) => {
    try {

        const userId = req.user.userId;

        const result = await db.execute({
            sql: `
                SELECT
                    Address_id,
                    Street_address,
                    City,
                    Zip_code
                FROM Address
                WHERE Customer_id = ?
                ORDER BY Address_id
            `,
            args: [userId]
        });

        return res.status(200).json(result.rows);

    } catch (error) {

        console.error("Address API Error:", error);

        return res.status(500).json({
            error: "Unable to retrieve addresses"
        });
    }
});

// UPDATE CURRENT USER ADDRESS
router.put(
    "/addresses/:addressId",
    checkAuth("user"),
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const addressId = req.params.addressId;

            const {
                streetAddress,
                city,
                zipCode
            } = req.body;

            if (!userId) {
                return res.status(401).json({
                    error: "User ID not found"
                });
            }
            if (!streetAddress?.trim() || !city?.trim() || !zipCode?.trim()) {
                return res.status(400).json({
                    error:
                        "Street address, city, and zip code are required"
                });
            }
            const result = await db.execute({
                sql: `
                    UPDATE Address
                    SET
                        Street_address = ?,
                        City = ?,
                        Zip_code = ?
                    WHERE Address_id = ?
                    AND Customer_id = ?
                `,
                args: [
                    streetAddress.trim(),
                    city.trim(),
                    zipCode.trim(),
                    addressId,
                    userId
                ]
            });
            if (!result.rowsAffected) {
                return res.status(404).json({
                    error: "Address not found"
                });
            }
            return res.status(200).json({
                message: "Address updated successfully",
                address: {
                    Address_id: Number(addressId),
                    Street_address: streetAddress.trim(),
                    City: city.trim(),
                    Zip_code: zipCode.trim()
                }
            });
        } catch (error) {
            console.error(
                "Address update error:",
                error
            );
            return res.status(500).json({
                error: "Unable to update address"
            });
        }
    }
);

// DELETE CURRENT USER ADDRESS
router.delete(
    "/addresses/:addressId",
    checkAuth("user"),
    async (req, res) => {
        try {
            const userId = req.user.userId;
            const addressId = req.params.addressId;

            if (!userId) {
                return res.status(401).json({
                    error: "User ID not found"
                });
            }

            if (!addressId) {
                return res.status(400).json({
                    error: "Address ID is required"
                });
            }

            const result = await db.execute({
                sql: `
                    DELETE FROM Address
                    WHERE Address_id = ?
                    AND Customer_id = ?
                `,
                args: [
                    addressId,
                    userId
                ]
            });

            if (!result.rowsAffected) {
                return res.status(404).json({
                    error: "Address not found"
                });
            }

            return res.status(200).json({
                message: "Address deleted successfully",
                addressId: Number(addressId)
            });

        } catch (error) {
            console.error(
                "Address deletion error:",
                error
            );

            return res.status(500).json({
                error: "Unable to delete address"
            });
        }
    }
);

// CREATE ADDRESS FOR CURRENT USER
router.post("/addresses", checkAuth("user"), async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            streetAddress,
            city,
            zipCode
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                error: "User ID not found"
            });
        }

        if (
            !streetAddress?.trim() ||
            !city?.trim() ||
            !zipCode?.trim()
        ) {
            return res.status(400).json({
                error:
                    "Street address, city, and zip code are required"
            });
        }

        const result = await db.execute({
            sql: `
                INSERT INTO Address (
                    Customer_id,
                    Street_address,
                    City,
                    Zip_code
                )
                VALUES (?, ?, ?, ?)
            `,
            args: [
                userId,
                streetAddress.trim(),
                city.trim(),
                zipCode.trim()
            ]
        });

        return res.status(201).json({
            message: "Address created successfully",
            addressId: Number(result.lastInsertRowid)
        });

    } catch (error) {
        console.error("Create address error:", error);

        return res.status(500).json({
            error: "Unable to create address"
        });
    }
});

module.exports = router;
