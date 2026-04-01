//from src/hspace.js
// Quadtree-based spatial hashing for fast range queries
(function () {
	// Quadtree node for hierarchical spatial partitioning
	class QuadNode {
		constructor(x, y, size) {
			this.x = x;
			this.y = y;
			this.size = size;
			this.half = size * 0.5; // Cache half-size
			this.midX = x + this.half;
			this.midY = y + this.half;
			this.objects = [];
			this.children = null;
		}

		clear() {
			this.objects.length = 0;
			if (this.children) {
				for (let i = 0; i < 4; i++) {
					this.children[i].clear();
				}
				this.children = null;
			}
		}

		subdivide() {
			const half = this.half;
			const x = this.x;
			const y = this.y;
			this.children = [
				new QuadNode(x, y, half), // top-left
				new QuadNode(x + half, y, half), // top-right
				new QuadNode(x, y + half, half), // bottom-left
				new QuadNode(x + half, y + half, half), // bottom-right
			];
		}

		insert(thing) {
			if (this.children) {
				// Has children, find which quadrant using bitwise index
				const px = thing.pos[0];
				const py = thing.pos[1];
				const idx =
					(px >= this.midX ? 1 : 0) | (py >= this.midY ? 2 : 0);
				this.children[idx].insert(thing);
			} else {
				// Leaf node
				this.objects.push(thing);

				// Subdivide if too crowded
				if (this.objects.length > 16 && this.size > 100) {
					this.subdivide();
					const objList = this.objects;
					const len = objList.length;
					this.objects = [];
					for (let i = 0; i < len; i++) {
						this.insert(objList[i]);
					}
				}
			}
		}

		queryRange(px, py, r2) {
			// Check if this node's bounding box intersects the query circle
			const dx = Math.max(Math.abs(px - this.midX) - this.half, 0);
			const dy = Math.max(Math.abs(py - this.midY) - this.half, 0);

			if (dx * dx + dy * dy > r2) {
				return null; // Node is outside range, skip
			}

			const children = this.children;
			if (children) {
				// Query children - unrolled for speed
				return (
					children[0].queryRange(px, py, r2) ||
					children[1].queryRange(px, py, r2) ||
					children[2].queryRange(px, py, r2) ||
					children[3].queryRange(px, py, r2)
				);
			}
			return this; // Return leaf node for processing
		}
	}

	window.HSpace = class HSpace {
		constructor(resolution) {
			this.resolution = resolution;
			// World bounds: -20000 to 20000
			this.root = new QuadNode(-20000, -20000, 40000);
		}

		clear() {
			this.root.clear();
		}

		insert(thing) {
			this.root.insert(thing);
		}

		findInRange(point, range, cb) {
			sim.timeStart("findInRange");
			const r2 = range * range;
			const px = point[0];
			const py = point[1];
			this._queryRecursive(this.root, px, py, r2, cb);
			sim.timeEnd("findInRange");
		}

		_queryRecursive(node, px, py, r2, cb) {
			// Check if this node's bounding box intersects the query circle
			const dx = Math.abs(px - node.midX) - node.half;
			const dy = Math.abs(py - node.midY) - node.half;
			const clampedDx = dx > 0 ? dx : 0;
			const clampedDy = dy > 0 ? dy : 0;

			if (clampedDx * clampedDx + clampedDy * clampedDy > r2) {
				return false;
			}

			const children = node.children;
			if (children) {
				// Query children
				for (let i = 0; i < 4; i++) {
					if (this._queryRecursive(children[i], px, py, r2, cb))
						return true;
				}
			} else {
				  // Check all objects in this leaf
				const objects = node.objects;
				const len = objects.length;
				for (let i = 0; i < len; i++) {
					const t = objects[i];
					const tdx = t.pos[0] - px;
					const tdy = t.pos[1] - py;
					if (tdx * tdx + tdy * tdy <= r2 && cb(t)) {
						return true;
					}
				}
			}
			return false;
		}
	};
}).call(this);
