const express = require("express");
const app = express.Router();

const { requireAuth } = require("../../imports/token");
const db = require("../../imports/database");

app.customPath = "/api";

/*
 * GET THE LOGGED-IN CUSTOMER'S WISHLIST
 */
app.get(
    "/fetchWishlist",
    requireAuth("user"),
    async (req, res) => {
        try {
            const customerId =
                Number(req.user.userId);

            if (!customerId) {
                return res.status(401).json({
                    error: "Customer is not logged in"
                });
            }

            const result = await db.execute({
                sql: `
                    SELECT
                        w.Customer_id AS customer_id,

                        p.product_id,
                        p.Prod_name AS product_name,
                        p.Prod_likes AS product_likes,
                        p.Prod_price AS product_price,
                        p.Prod_amount AS product_amount,
                        p.Prod_img AS product_image,
                        p."desc" AS product_desc,
                        p.type_id

                    FROM Customer_wishlist w

                    JOIN Product p
                        ON w.product_id = p.product_id

                    WHERE w.Customer_id = ?
                    AND LOWER(COALESCE(p.Status, 'Shown')) = 'shown'

                    ORDER BY p.Prod_name ASC
                `,
                args: [customerId]
            });

            return res.status(200).json(
                result.rows
            );

        } catch (error) {
            console.error(
                "Failed to fetch wishlist:",
                error
            );

            return res.status(500).json({
                error: "Failed to fetch wishlist"
            });
        }
    }
);

/*
 * ADD A PRODUCT OR BUNDLE TO THE LOGGED-IN CUSTOMER'S WISHLIST
 */
app.post(
    "/addWishlist",
    requireAuth("user"),
    async (req, res) => {
        try {
            const customerId =
                Number(req.user.userId);

            const productId =
                Number(req.body.productId);

            if (!customerId) {
                return res.status(401).json({
                    error: "Customer is not logged in"
                });
            }

            if (!productId) {
                return res.status(400).json({
                    error: "A valid productId is required"
                });
            }

            /*
             * Verify that the selected product or bundle exists.
             * Bundles also use product_id because they are stored
             * in the Product table with type_id = 2.
             */
            const productResult = await db.execute({
                sql: `
                    SELECT
                        product_id,
                        type_id,
                        Status
                    FROM Product
                    WHERE product_id = ?
                    AND LOWER(COALESCE(Status, 'Shown')) = 'shown'
                `,
                args: [productId]
            });

            if (productResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Product not found"
                });
            }

            /*
             * Check whether this customer already has the item.
             */
            const existingResult = await db.execute({
                sql: `
                    SELECT product_id
                    FROM Customer_wishlist
                    WHERE Customer_id = ?
                    AND product_id = ?
                `,
                args: [
                    customerId,
                    productId
                ]
            });

            if (existingResult.rows.length > 0) {
                return res.status(409).json({
                    error:
                        "Product is already in the wishlist",
                    alreadyExists: true
                });
            }

            await db.execute({
                sql: `
                    INSERT INTO Customer_wishlist (
                        Customer_id,
                        product_id
                    )
                    VALUES (?, ?)
                `,
                args: [
                    customerId,
                    productId
                ]
            });

            return res.status(201).json({
                message: "Product added to wishlist",
                customerId: customerId,
                productId: productId
            });

        } catch (error) {
            console.error(
                "Failed to add product to wishlist:",
                error
            );

            /*
             * Keep this as a database-level fallback in case two
             * requests are made at nearly the same time.
             */
            if (
                error.message?.includes("UNIQUE") ||
                error.message?.includes("PRIMARY KEY")
            ) {
                return res.status(409).json({
                    error:
                        "Product is already in the wishlist",
                    alreadyExists: true
                });
            }

            return res.status(500).json({
                error:
                    "Failed to add product to wishlist"
            });
        }
    }
);

// drop wishlist row
app.delete( "/removeWishlist/:productId", requireAuth("user"),
    async (req, res) => {
        try {
            const customerId = req.user.userId;
            const productId = Number(req.params.productId);

            await db.execute({
                sql: `
                    DELETE
                    FROM Customer_wishlist
                    WHERE Customer_id = ?
                    AND product_id = ?
                `,
                args: [
                    customerId,
                    productId
                ]
            });

            res.json({
                message: "Wishlist item removed"
            });
        } catch (error) {
            console.error(error);

            res.status(500).json({
                error:
                    "Failed to remove wishlist item"
            });
        }
    }
);

module.exports = app;
